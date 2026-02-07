import { SourceFile, ImportDeclaration } from 'ts-morph';
import { BasePrimitive } from './base-primitive.js';
import { type ImportConfig } from '../../types.js';
import { Normalizer } from '../../../utils/normalizer.js';

export class ImportPrimitive extends BasePrimitive<ImportDeclaration, ImportConfig> {
  find(parent: SourceFile) {
    const normalizedTarget = Normalizer.normalizeImport(this.config.moduleSpecifier);

    return parent.getImportDeclaration((decl) => {
      const normalizedExisting = Normalizer.normalizeImport(decl.getModuleSpecifierValue());
      return normalizedExisting === normalizedTarget;
    });
  }

  create(parent: SourceFile) {
    return parent.addImportDeclaration({
      moduleSpecifier: Normalizer.normalizeImport(this.config.moduleSpecifier),
      defaultImport: this.config.defaultImport,
      namedImports: this.config.namedImports,
      isTypeOnly: this.config.isTypeOnly,
    });
  }

  update(node: ImportDeclaration) {
    const sourceFile = node.getSourceFile();
    const normalizedTarget = Normalizer.normalizeImport(this.config.moduleSpecifier);

    // 0. Deduplicate: Find OTHER imports that normalize to the same target OR provide the same symbols
    const targetSymbols = this.config.namedImports || [];

    sourceFile.getImportDeclarations().forEach((decl) => {
      if (decl === node) return;

      const normalizedExisting = Normalizer.normalizeImport(decl.getModuleSpecifierValue());

      // Case A: Same module (normalized)
      if (normalizedExisting === normalizedTarget) {
        // Merge named imports before removal
        const existingNamed = decl.getNamedImports();
        if (existingNamed.length > 0) {
          const currentNames = node.getNamedImports().map((ni) => ni.getText());
          const missing = existingNamed
            .map((ni) => ni.getText())
            .filter((name) => !currentNames.includes(name));

          if (missing.length > 0) {
            node.addNamedImports(missing);
          }
        }
        decl.remove();
        return;
      }

      // Case B: Different module, but overlapping symbols from "similar" paths
      // We only do this if BOTH are @modules or BOTH are relative to avoid breaking complex aliasing
      const isTargetAliased = normalizedTarget.startsWith('@');
      const isExistingAliased = normalizedExisting.startsWith('@');

      if (isTargetAliased === isExistingAliased) {
        const existingNamed = decl.getNamedImports();
        existingNamed.forEach((ni) => {
          const sym = ni.getText().replace(/^type\s+/, '');
          if (targetSymbols.includes(sym)) {
            console.info(
              `[ImportPrimitive] Removing duplicate symbol '${sym}' from ${normalizedExisting} (moving to ${normalizedTarget})`,
            );
            ni.remove();
          }
        });

        // If existing decl is now empty, remove it
        if (
          decl.getNamedImports().length === 0 &&
          !decl.getDefaultImport() &&
          !decl.getNamespaceImport()
        ) {
          decl.remove();
        }
      }
    });

    // 1. Enforce Normalized Module Specifier
    if (node.getModuleSpecifierValue() !== normalizedTarget) {
      node.setModuleSpecifier(normalizedTarget);
    }

    // 2. Enforce Type Only
    if (this.config.isTypeOnly !== undefined && node.isTypeOnly() !== this.config.isTypeOnly) {
      node.setIsTypeOnly(this.config.isTypeOnly);

      // Fallback: if it didn't change (e.g. ts-morph behavior in some versions), force it
      if (node.isTypeOnly() !== this.config.isTypeOnly) {
        const text = node.getText();
        if (this.config.isTypeOnly && !text.includes('import type')) {
          node.replaceWithText(text.replace(/^import\s+/, 'import type '));
        } else if (!this.config.isTypeOnly && text.includes('import type')) {
          node.replaceWithText(text.replace(/^import type\s+/, 'import '));
        }
      }
    }

    // 3. Add missing named imports
    if (this.config.namedImports) {
      const namedImports = node.getNamedImports();
      const normalizedExisting = namedImports.map((ni) => ni.getText().replace(/^type\s+/, ''));

      // Remove imports not in the config
      namedImports.forEach((ni) => {
        const name = ni.getText().replace(/^type\s+/, '');
        if (!this.config.namedImports?.includes(name)) {
          ni.remove();
        }
      });

      const missingImports = this.config.namedImports.filter(
        (ni) => !normalizedExisting.includes(ni),
      );

      if (missingImports.length > 0) {
        node.addNamedImports(missingImports);
      }

      // Cleanup redundant/duplicate named imports
      const seen = new Set<string>();
      node.getNamedImports().forEach((ni) => {
        const text = ni.getText();
        const normalized = text.replace(/^type\s+/, '');

        if (seen.has(normalized)) {
          ni.remove();
          return;
        }
        seen.add(normalized);
      });

      // Re-run cleanup to remove internal 'type ' prefixes if top-level is type-only
      if (node.isTypeOnly()) {
        node.getNamedImports().forEach((ni) => {
          const text = ni.getText();
          if (text.startsWith('type ')) {
            const newName = text.replace(/^type\s+/, '');
            ni.remove();
            if (!node.getNamedImports().some((n) => n.getName() === newName)) {
              node.addNamedImport(newName);
            }
          }
        });
      }
    }

    // 4. Remove if empty (no named, no default)
    if (
      !node.getDefaultImport() &&
      node.getNamedImports().length === 0 &&
      !node.getNamespaceImport()
    ) {
      node.remove();
    }
  }
  validate(node: ImportDeclaration): import('../contracts.js').ValidationResult {
    const issues: string[] = [];

    // Check module specifier
    const normalizedTarget = Normalizer.normalizeImport(this.config.moduleSpecifier);
    const normalizedExisting = Normalizer.normalizeImport(node.getModuleSpecifierValue());
    if (normalizedExisting !== normalizedTarget) {
      issues.push(
        `Import module specifier mismatch. Expected: ${normalizedTarget} (normalized), Found: ${normalizedExisting}`,
      );
    }

    // Check default import
    if (this.config.defaultImport) {
      const defaultImport = node.getDefaultImport();
      if (!defaultImport || defaultImport.getText() !== this.config.defaultImport) {
        issues.push(
          `Import '${this.config.moduleSpecifier}' default import mismatch. Expected: ${this.config.defaultImport}, Found: ${defaultImport?.getText() ?? 'none'}`,
        );
      }
    }

    // Check named imports
    if (this.config.namedImports) {
      const namedImports = node.getNamedImports();
      const existingTexts = namedImports.map((ni) => ni.getText()); // Includes "Name as Alias"
      const missingImports = this.config.namedImports.filter((ni) => !existingTexts.includes(ni));
      if (missingImports.length > 0) {
        issues.push(
          `Import '${this.config.moduleSpecifier}' missing named imports: ${missingImports.join(', ')}`,
        );
      }
    }

    // Check Type Only
    if (this.config.isTypeOnly !== undefined && node.isTypeOnly() !== this.config.isTypeOnly) {
      issues.push(
        `Import '${this.config.moduleSpecifier}' type-only mismatch. Expected: ${this.config.isTypeOnly}, Found: ${node.isTypeOnly()}`,
      );
    }

    return { valid: issues.length === 0, issues };
  }
}
