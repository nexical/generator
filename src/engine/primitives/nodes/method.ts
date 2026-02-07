import {
  ClassDeclaration,
  Scope,
  type MethodDeclarationStructure,
  type OptionalKind,
  MethodDeclaration,
  Node,
  Statement,
} from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { DecoratorPrimitive } from './decorator.js';
import { JSDocPrimitive } from './docs.js';
import { type ValidationResult } from '../contracts.js';
import { type MethodConfig, type ParsedStatement } from '../../types.js';
import { StatementFactory } from '../statements/factory.js';
import { Normalizer } from '../../../utils/normalizer.js';

export class MethodPrimitive extends BasePrimitive<MethodDeclaration, MethodConfig> {
  find(parent: ClassDeclaration) {
    // Handle overload matching logic here if you want to be fancy
    return parent.getMethod(this.config.name) || parent.getStaticMethod(this.config.name);
  }

  create(parent: ClassDeclaration): MethodDeclaration {
    return parent.addMethod(this.toStructure());
  }

  update(node: MethodDeclaration) {
    // "Drift Correction" Logic
    const structure = this.toStructure();

    // Enforce Async
    if (structure.isAsync !== node.isAsync()) {
      node.setIsAsync(structure.isAsync!);
    }

    // Enforce Static
    if (structure.isStatic !== node.isStatic()) {
      node.setIsStatic(structure.isStatic!);
    }

    // Enforce Return Type
    if (structure.returnType && node.getReturnType().getText() !== structure.returnType) {
      node.setReturnType(structure.returnType as string);
    }

    // Enforce Parameters (Strict Match)
    const currentParams = node.getParameters();
    const newParams = structure.parameters || [];

    // Simple check: if length differs, or if any param name/type differs -> Rewrite all parameters
    // This is safer than partial updates for parameters to avoid ordering issues.
    let paramsChanged = false;

    if (currentParams.length !== newParams.length) {
      paramsChanged = true;
    } else {
      for (let i = 0; i < currentParams.length; i++) {
        const cur = currentParams[i];
        const neu = newParams[i];
        const neuType = neu.type as string; // We enforce explicit types in generator

        if (cur.getName() !== neu.name) {
          paramsChanged = true;
          break;
        }

        // Type check (ignoring whitespace and delimiters for improved stability)
        const curType = cur.getTypeNode()?.getText() || 'any'; // fallback if implicit
        if (Normalizer.normalizeType(curType) !== Normalizer.normalizeType(neuType)) {
          console.info(
            `[MethodPrimitive] Param mismatch for ${this.config.name}: '${curType}' != '${neuType}'`,
          );
          paramsChanged = true;
          break;
        }

        // Question token check
        if (cur.hasQuestionToken() !== !!neu.hasQuestionToken) {
          paramsChanged = true;
          break;
        }
      }
    }

    if (paramsChanged) {
      // Overwrite parameters
      node.getParameters().forEach((p) => p.remove());
      node.addParameters(newParams);
    }

    // Body Reconciliation
    this.reconcileBody(node);

    // Update Decorators
    this.config.decorators?.forEach((deco) => {
      new DecoratorPrimitive(deco).ensure(node);
    });

    // Handle JSDocs
    if (this.config.docs) {
      const description = this.config.docs.join('\n');
      new JSDocPrimitive({ description }).ensure(node);
    }
  }

  validate(node: MethodDeclaration): ValidationResult {
    // The node is already found and passed in
    const method = node; // Alias for clarity/diff minimization

    const issues: string[] = [];
    const structure = this.toStructure();

    if (structure.isAsync !== undefined && method.isAsync() !== structure.isAsync) {
      issues.push(
        `Method '${this.config.name}' async modifier mismatch. Expected: ${structure.isAsync}, Found: ${method.isAsync()}`,
      );
    }

    if (structure.isStatic !== undefined && method.isStatic() !== structure.isStatic) {
      issues.push(
        `Method '${this.config.name}' static modifier mismatch. Expected: ${structure.isStatic}, Found: ${method.isStatic()}`,
      );
    }

    const returnTypeNode = method.getReturnTypeNode();
    const currentReturnTypeRaw = returnTypeNode?.getText();
    const currentReturnType = currentReturnTypeRaw
      ? Normalizer.normalizeType(currentReturnTypeRaw)
      : undefined;

    if (
      typeof structure.returnType === 'string' &&
      currentReturnType !== Normalizer.normalizeType(structure.returnType)
    ) {
      issues.push(
        `Method '${this.config.name}' return type mismatch. Expected: ${structure.returnType}, Found: ${currentReturnTypeRaw || 'implicit/void'}`,
      );
    }

    // Validate Parameters
    const currentParams = method.getParameters();
    const newParams = structure.parameters || [];

    if (currentParams.length !== newParams.length) {
      issues.push(
        `Method '${this.config.name}' parameter count mismatch. Expected: ${newParams.length}, Found: ${currentParams.length}`,
      );
    } else {
      for (let i = 0; i < currentParams.length; i++) {
        const cur = currentParams[i];
        const neu = newParams[i];
        const neuType = neu.type as string;

        if (cur.getName() !== neu.name) {
          issues.push(
            `Method '${this.config.name}' parameter ${i} name mismatch. Expected: ${neu.name}, Found: ${cur.getName()}`,
          );
        }

        const curTypeRaw = cur.getTypeNode()?.getText() || 'any';
        // Strip import("...") and other qualifiers for basic semantic check
        const curType = Normalizer.normalizeType(curTypeRaw);

        if (curType !== Normalizer.normalizeType(neuType)) {
          issues.push(
            `Method '${this.config.name}' parameter '${neu.name}' type mismatch. Expected: ${neuType}, Found: ${curTypeRaw}`,
          );
        }
      }
    }

    // Validate Decorators
    this.config.decorators?.forEach((deco) => {
      const primitive = new DecoratorPrimitive(deco);
      const decoNode = primitive.find(method);
      if (!decoNode) {
        issues.push(`Decorator '@${deco.name}' is missing on method '${this.config.name}'.`);
      } else {
        const result = primitive.validate(decoNode);
        if (!result.valid) issues.push(...result.issues);
      }
    });

    // Validate JSDocs
    if (this.config.docs) {
      const description = this.config.docs.join('\n');
      const primitive = new JSDocPrimitive({ description });
      const docNode = primitive.find(method);
      if (!docNode) {
        issues.push(`JSDoc is missing on method '${this.config.name}'.`);
      } else {
        const result = primitive.validate(docNode);
        if (!result.valid) issues.push(...result.issues);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  private toStructure(): OptionalKind<MethodDeclarationStructure> {
    return {
      name: this.config.name,
      isStatic: this.config.isStatic,
      isAsync: this.config.isAsync,
      returnType: this.config.returnType,
      parameters: this.config.parameters?.map((p) => ({
        name: p.name,
        type: p.type,
        hasQuestionToken: p.optional,
      })),
      statements: StatementFactory.generateBlock(this.config.statements),
      scope: this.config.scope || Scope.Public,
      decorators: this.config.decorators?.map((d) => ({ name: d.name, arguments: d.arguments })),
      docs: this.config.docs ? [{ description: this.config.docs.join('\n') }] : undefined,
    };
  }

  private reconcileBody(node: MethodDeclaration) {
    if (!this.config.statements) {
      return;
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
          // Manual delete logic removed
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
