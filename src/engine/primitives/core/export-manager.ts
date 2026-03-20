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
    console.error(`[ExportPrimitive] Creating export for ${this.config.moduleSpecifier}`);
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
    }

    if (this.config.exportClause === '*') {
      if (node.getNamedExports().length > 0) {
        node.getNamedExports().forEach((ne) => ne.remove());
      }
    } else if (Array.isArray(this.config.exportClause)) {
      const namedExports = node.getNamedExports();
      const normalizedExisting = namedExports.map((ne) => ne.getName());

      const missingExports = this.config.exportClause.filter(
        (ne) => !normalizedExisting.includes(ne),
      );

      if (missingExports.length > 0) {
        node.addNamedExports(missingExports);
      }

      // Cleanup redundant/duplicate named exports
      const seen = new Set<string>();
      node.getNamedExports().forEach((ne) => {
        const normalized = ne.getName();

        if (seen.has(normalized)) {
          ne.remove();
          return;
        }
        seen.add(normalized);
      });

      // Re-run cleanup to remove internal 'type ' prefixes if top-level is type-only
      if (node.isTypeOnly()) {
        node.getNamedExports().forEach((ne) => {
          if (ne.isTypeOnly()) {
            ne.setIsTypeOnly(false);
          }
        });
      }
    }
  }

  validate(node: ExportDeclaration): import('../contracts.js').ValidationResult {
    const issues: string[] = [];

    if (Array.isArray(this.config.exportClause)) {
      const existingNamedExports = node.getNamedExports().map((ne) => ne.getName());
      const missingExports = this.config.exportClause.filter(
        (ne) => !existingNamedExports.includes(ne),
      );
      if (missingExports.length > 0) {
        issues.push(
          `Export '${this.config.moduleSpecifier}' missing named exports: ${missingExports.join(', ')}`,
        );
      }
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
