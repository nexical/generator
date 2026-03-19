import {
  SourceFile,
  VariableStatement,
  VariableDeclarationKind,
  ModuleDeclaration,
  CodeBlockWriter,
} from 'ts-morph';

import { BasePrimitive } from '../core/base-primitive.js';
import { type VariableConfig } from '../../types.js';
import { type ValidationResult } from '../contracts.js';
import { Normalizer } from '../../../utils/normalizer.js';

export class VariablePrimitive extends BasePrimitive<VariableStatement, VariableConfig> {
  find(parent: SourceFile | ModuleDeclaration) {
    // ts-morph doesn't have a direct getVariableStatement(name) that works simply like classes
    // We need to find the statement that contains the declaration with the name
    return parent.getVariableStatement((node) => {
      return node.getDeclarations().some((d) => d.getName() === this.config.name);
    });
  }

  create(parent: SourceFile | ModuleDeclaration): VariableStatement {
    return parent.addVariableStatement({
      declarationKind: this.getDeclarationKind(this.config.declarationKind),
      isExported: this.config.isExported,
      declarations: [
        {
          name: this.config.name,
          type: this.config.type,
          initializer: this.wrapObjectLiteral(this.getInitializerText(this.config.initializer)),
        },
      ],
      leadingTrivia: this.config.comments
        ? (writer: CodeBlockWriter) => {
            this.config.comments?.forEach((c) =>
              writer.writeLine(c.startsWith('//') ? c : `// ${c}`),
            );
          }
        : undefined,
    });
  }

  update(node: VariableStatement) {
    // If this is a default variable and it already exists, leave it alone.
    if (this.config.isDefault) {
      return;
    }

    const decl = node.getDeclarations().find((d) => d.getName() === this.config.name);
    if (!decl) return; // Should not happen if find() works

    if (this.config.isExported !== undefined && node.isExported() !== this.config.isExported) {
      node.setIsExported(this.config.isExported);
    }

    const kind = this.getDeclarationKind(this.config.declarationKind);
    if (node.getDeclarationKind() !== kind) {
      node.setDeclarationKind(kind);
    }

    if (
      this.config.type &&
      Normalizer.normalizeType(decl.getType().getText()) !==
        Normalizer.normalizeType(this.config.type)
    ) {
      decl.setType(this.config.type);
    }

    const initText = this.wrapObjectLiteral(this.getInitializerText(this.config.initializer));
    if (initText) {
      const currentInit = decl.getInitializer();
      const currentInitText = currentInit?.getText() || '';

      if (Normalizer.normalize(currentInitText) !== Normalizer.normalize(initText)) {
        // If the initializer is very large or complex (like Astro GET/POST handlers),
        // setInitializer can trigger a stack overflow in ts-morph's ParentFinder.
        // We proactively use a top-level replacement for large initializers.
        if (initText.length > 2000) {
          console.warn(
            `[VariablePrimitive] Initializer for ${this.config.name} is large (${initText.length}), using top-level replaceWithText to avoid ts-morph recursion`,
          );
          const kind = this.config.declarationKind || 'const';
          const exported = this.config.isExported ? 'export ' : '';
          const typeStr = this.config.type ? `: ${this.config.type}` : '';
          const comments = this.config.comments
            ? this.config.comments
                .map((c) => (c.startsWith('//') ? `${c}\n` : `// ${c}\n`))
                .join('')
            : '';
          const newStatementText = `${comments}${exported}${kind} ${this.config.name}${typeStr} = ${initText};`;
          node.replaceWithText(newStatementText);
          return;
        }

        try {
          decl.setInitializer((writer) => {
            writer.write(initText!);
          });
        } catch {
          console.warn(
            `[VariablePrimitive] Failed to set initializer for ${this.config.name} via writer, falling back to direct initializer replacement.`,
          );
          try {
            const currentInitNode = decl.getInitializer();
            if (currentInitNode) {
              currentInitNode.replaceWithText(initText!);
            } else {
              decl.setInitializer(initText!);
            }
          } catch {
            console.error(
              `[VariablePrimitive] Critical failure updating ${this.config.name}, trying statement replacement as last resort`,
            );
            const kind = this.config.declarationKind || 'const';
            const exported = this.config.isExported ? 'export ' : '';
            const typeStr = this.config.type ? `: ${this.config.type}` : '';
            const newStatementText = `${exported}${kind} ${this.config.name}${typeStr} = ${initText};`;
            node.replaceWithText(newStatementText);
          }
        }
      }
    }

    // Comments / Trivia
    if (this.config.comments && this.config.comments.length > 0) {
      const currentFullText = node.getFullText();
      const currentText = node.getText();
      const currentTrivia = currentFullText.substring(0, currentFullText.indexOf(currentText));

      const missingComments = this.config.comments.filter((c) => {
        const formatted = c.startsWith('//') ? c : `// ${c}`;
        return !currentTrivia.includes(formatted);
      });

      if (missingComments.length > 0) {
        const newTrivia =
          missingComments.map((c) => (c.startsWith('//') ? c : `// ${c}`)).join('\n') + '\n';
        node.replaceWithText(`${newTrivia}${currentText}`);
      }
    }
  }

  private getInitializerText(initializer?: string | { raw: string }): string | undefined {
    if (!initializer) return undefined;
    if (typeof initializer === 'string') return initializer;
    return initializer.raw;
  }

  private wrapObjectLiteral(text?: string): string | undefined {
    if (!text) return text;
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return `(${trimmed})`;
    }
    return text;
  }

  validate(node: VariableStatement): ValidationResult {
    const issues: string[] = [];
    const decl = node.getDeclarations().find((d) => d.getName() === this.config.name);

    if (!decl) {
      return {
        valid: false,
        issues: [`Variable declaration '${this.config.name}' not found within statement.`],
      };
    }

    if (this.config.isExported !== undefined && node.isExported() !== this.config.isExported) {
      issues.push(`Variable '${this.config.name}' export mismatch.`);
    }

    if (this.config.initializer && decl.getInitializer()?.getText() !== this.config.initializer) {
      issues.push(
        `Variable '${this.config.name}' initializer mismatch. Expected: ${this.config.initializer}, Found: ${decl.getInitializer()?.getText()}`,
      );
    }

    return { valid: issues.length === 0, issues };
  }

  private getDeclarationKind(kind?: 'const' | 'let' | 'var'): VariableDeclarationKind {
    switch (kind) {
      case 'let':
        return VariableDeclarationKind.Let;
      case 'var':
        return VariableDeclarationKind.Var;
      default:
        return VariableDeclarationKind.Const;
    }
  }
}
