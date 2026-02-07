import {
  SourceFile,
  FunctionDeclaration,
  type OptionalKind,
  type FunctionDeclarationStructure,
  ModuleDeclaration,
  Node,
  Statement,
} from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { type FunctionConfig, type ParsedStatement } from '../../types.js';
import { type ValidationResult } from '../contracts.js';
import { StatementFactory } from '../statements/factory.js';
import { Normalizer } from '../../../utils/normalizer.js';

export class FunctionPrimitive extends BasePrimitive<FunctionDeclaration, FunctionConfig> {
  find(parent: SourceFile | ModuleDeclaration) {
    return parent.getFunction(this.config.name);
  }

  create(parent: SourceFile | ModuleDeclaration): FunctionDeclaration {
    return parent.addFunction(this.toStructure());
  }

  update(node: FunctionDeclaration) {
    const structure = this.toStructure();

    if (structure.isAsync !== undefined && node.isAsync() !== structure.isAsync) {
      node.setIsAsync(structure.isAsync);
    }

    if (
      structure.returnType &&
      Normalizer.normalizeType(node.getReturnType().getText()) !==
        Normalizer.normalizeType(structure.returnType as string)
    ) {
      node.setReturnType(structure.returnType as string);
    }

    // Reconcile Parameters
    if (structure.parameters) {
      const existingParams = node.getParameters();
      structure.parameters.forEach((paramStruct, index) => {
        const existingParam = existingParams[index];
        if (existingParam) {
          // Update main properties if they differ
          if (existingParam.getName() !== paramStruct.name) {
            existingParam.rename(paramStruct.name);
          }
          if (
            paramStruct.type &&
            Normalizer.normalizeType(existingParam.getTypeNode()?.getText() || '') !==
              Normalizer.normalizeType(paramStruct.type as string)
          ) {
            existingParam.setType(paramStruct.type as string);
          }
        } else {
          // Add new parameter
          node.addParameter(paramStruct);
        }
      });
      // Ideally we might remove extra parameters, but that's risky.
      // For now, strict index matching for generated code is acceptable.
    }

    // Body Reconciliation
    this.reconcileBody(node);
  }

  validate(node: FunctionDeclaration): ValidationResult {
    const issues: string[] = [];
    const structure = this.toStructure();

    if (structure.isAsync !== undefined && node.isAsync() !== structure.isAsync) {
      issues.push(
        `Function '${this.config.name}' async modifier mismatch. Expected: ${structure.isAsync}, Found: ${node.isAsync()}`,
      );
    }

    if (
      structure.returnType &&
      Normalizer.normalizeType(node.getReturnType().getText()) !==
        Normalizer.normalizeType(structure.returnType as string)
    ) {
      issues.push(
        `Function '${this.config.name}' return type mismatch. Expected: ${structure.returnType}, Found: ${node.getReturnType().getText()}`,
      );
    }

    return { valid: issues.length === 0, issues };
  }

  private toStructure(): OptionalKind<FunctionDeclarationStructure> {
    return {
      name: this.config.name,
      isExported: this.config.isExported,
      isAsync: this.config.isAsync,
      returnType: this.config.returnType,
      parameters: this.config.parameters?.map((p) => ({
        name: p.name,
        type: p.type,
        hasQuestionToken: p.optional,
      })),
      statements: StatementFactory.generateBlock(this.config.statements),
    };
  }

  private reconcileBody(node: FunctionDeclaration) {
    if (!this.config.statements) {
      return;
    }

    if (this.config.overwriteBody) {
      node.setBodyText('');
    }

    const project = node.getProject();

    for (const stmtConfig of this.config.statements) {
      // 1. Handle ParsedStatement (Template fragments)
      if (stmtConfig && typeof stmtConfig === 'object' && 'getNodes' in stmtConfig) {
        const newStatements = (stmtConfig as ParsedStatement).getNodes(project);

        for (const newStmt of newStatements) {
          const match = this.findStructuralMatch(node.getStatements(), newStmt);
          if (match) continue;
          node.addStatements(newStmt.getText());
        }

        if (newStatements.length > 0) {
          // Manual delete logic removed in favor of cleanup()
        }
        if ((stmtConfig as ParsedStatement).cleanup) {
          (stmtConfig as ParsedStatement).cleanup!();
        }
        continue;
      }

      // 2. Handle Structured StatementConfig
      if (typeof stmtConfig === 'object' && 'kind' in stmtConfig) {
        const targetText = StatementFactory.generate(stmtConfig);
        const project = node.getProject();
        const tempFile = project.createSourceFile('__temp_stmt.ts', targetText, {
          overwrite: true,
        });
        const targetNode = tempFile.getStatements()[0];

        try {
          const match = this.findStructuralMatch(node.getStatements(), targetNode);

          if (match) {
            // Found structural match
            if (stmtConfig.isDefault) {
              // It's a default statement - leave user version alone
              continue;
            } else {
              // It's a required statement - ensure it matches exactly
              const normalizedExisting = Normalizer.normalize(match.getText());
              const normalizedTarget = Normalizer.normalize(targetText);
              if (normalizedExisting !== normalizedTarget) {
                match.replaceWithText(targetText);
              }
            }
          } else {
            // Missing -> Append
            node.addStatements(targetText);
          }
        } finally {
          tempFile.delete();
        }
        continue;
      }

      // 3. Fallback: Raw string (Legacy support within StatementConfig type for now)
      if (typeof stmtConfig === 'string') {
        const normalizedConfig = Normalizer.normalize(stmtConfig);
        const sourceText = Normalizer.normalize(node.getBodyText() || '');
        if (sourceText.includes(normalizedConfig)) continue;
        node.addStatements(stmtConfig);
      }
    }
  }

  private findStructuralMatch(existing: Statement[], target: Statement): Statement | undefined {
    const kind = target.getKind();
    return existing.find((s) => {
      if (s.getKind() !== kind) return false;

      // Variable Matching (by name)
      if (Node.isVariableStatement(s) && Node.isVariableStatement(target)) {
        const sNames = s
          .getDeclarationList()
          .getDeclarations()
          .map((d) => d.getName());
        const tNames = target
          .getDeclarationList()
          .getDeclarations()
          .map((d) => d.getName());
        return sNames.length > 0 && tNames.length > 0 && sNames[0] === tNames[0];
      }

      // If Matching (by condition)
      if (Node.isIfStatement(s) && Node.isIfStatement(target)) {
        return (
          Normalizer.normalize(s.getExpression().getText()) ===
          Normalizer.normalize(target.getExpression().getText())
        );
      }

      // Return Matching (assume singleton or simple match if it's a small block)
      if (Node.isReturnStatement(s) && Node.isReturnStatement(target)) {
        return true;
      }

      // Throw Matching
      if (Node.isThrowStatement(s) && Node.isThrowStatement(target)) {
        return true;
      }

      // TryStatement Matching
      if (Node.isTryStatement(s) && Node.isTryStatement(target)) {
        return true;
      }

      // Default: Text Match
      return Normalizer.normalize(s.getText()) === Normalizer.normalize(target.getText());
    });
  }
}
