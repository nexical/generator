import {
  SourceFile,
  ExportDeclaration,
  type ExportDeclarationStructure,
  StructureKind,
} from 'ts-morph';
import { BasePrimitive } from './base-primitive.js';
import { type ExportConfig } from '../../types.js';

export class ExportPrimitive extends BasePrimitive<ExportDeclaration, ExportConfig> {
  find(parent: SourceFile) {
    return parent.getExportDeclaration(
      (decl) =>
        decl.getModuleSpecifierValue() === this.config.moduleSpecifier &&
        (this.config.isTypeOnly === undefined || decl.isTypeOnly() === this.config.isTypeOnly),
    );
  }

  create(parent: SourceFile) {
    console.info(`[ExportPrimitive] Creating export for ${this.config.moduleSpecifier}`);
    const structure: ExportDeclarationStructure = {
      kind: StructureKind.ExportDeclaration,
      moduleSpecifier: this.config.moduleSpecifier,
      isTypeOnly: this.config.isTypeOnly,
    };

    if (Array.isArray(this.config.exportClause)) {
      structure.namedExports = this.config.exportClause;
    }
    // If exportClause is '*', we don't add namedExports, so it defaults to `export * from ...`

    return parent.addExportDeclaration(structure);
  }

  update(node: ExportDeclaration) {
    // Enforce Type Only
    if (this.config.isTypeOnly !== undefined && node.isTypeOnly() !== this.config.isTypeOnly) {
      node.setIsTypeOnly(this.config.isTypeOnly);

      // Fallback: if it didn't change, force it
      if (node.isTypeOnly() !== this.config.isTypeOnly) {
        const text = node.getText();
        if (this.config.isTypeOnly && !text.includes('export type')) {
          node.replaceWithText(text.replace(/^export\s+/, 'export type '));
        } else if (!this.config.isTypeOnly && text.includes('export type')) {
          node.replaceWithText(text.replace(/^export type\s+/, 'export '));
        }
      }
    }

    if (this.config.exportClause === '*') {
      if (node.getNamedExports().length > 0) {
        node.getNamedExports().forEach((ne) => ne.remove());
      }
    } else if (Array.isArray(this.config.exportClause)) {
      const namedExports = node.getNamedExports();
      const normalizedExisting = namedExports.map((ne) => ne.getText().replace(/^type\s+/, ''));

      const missingExports = this.config.exportClause.filter(
        (ne) => !normalizedExisting.includes(ne),
      );

      if (missingExports.length > 0) {
        node.addNamedExports(missingExports);
      }

      // Cleanup redundant/duplicate named exports
      const seen = new Set<string>();
      node.getNamedExports().forEach((ne) => {
        const text = ne.getText();
        const normalized = text.replace(/^type\s+/, '');

        if (seen.has(normalized)) {
          ne.remove();
          return;
        }
        seen.add(normalized);
      });

      // Re-run cleanup to remove internal 'type ' prefixes if top-level is type-only
      if (node.isTypeOnly()) {
        node.getNamedExports().forEach((ne) => {
          const text = ne.getText();
          if (text.startsWith('type ')) {
            const newName = text.replace(/^type\s+/, '');
            ne.remove();
            if (!node.getNamedExports().some((n) => n.getName() === newName)) {
              node.addNamedExport(newName);
            }
          }
        });
      }
    }
  }
  // If exportClause is '*', strictly enforcing that it is NOT a named export might be tricky if we matched an existing named export declaration.
  // But typically, `getExportDeclaration` returns the one matching module specifier.

  validate(node: ExportDeclaration): import('../contracts.js').ValidationResult {
    const issues: string[] = [];

    if (Array.isArray(this.config.exportClause)) {
      const existingNamedExports = node.getNamedExports().map((ne) => ne.getName());
      const normalizedExisting = existingNamedExports.map((name) => name.replace(/^type\s+/, ''));
      const missingExports = this.config.exportClause.filter(
        (ne) => !normalizedExisting.includes(ne),
      );
      if (missingExports.length > 0) {
        issues.push(
          `Export '${this.config.moduleSpecifier}' missing named exports: ${missingExports.join(', ')}`,
        );
      }
    } else if (this.config.exportClause === '*') {
      // Check if it is a namespace export or named export?
      // Ideally should check `!node.hasNamedExports()` but existing code might have mixed usage.
      // For now, assume if it exists, it's consistent enough or the user can manually fix complex cases.
    }

    // Check Type Only
    if (this.config.isTypeOnly !== undefined && node.isTypeOnly() !== this.config.isTypeOnly) {
      issues.push(
        `Export '${this.config.moduleSpecifier}' type-only mismatch. Expected: ${this.config.isTypeOnly}, Found: ${node.isTypeOnly()}`,
      );
    }

    return { valid: issues.length === 0, issues };
  }
}
