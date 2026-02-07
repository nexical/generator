/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ImportPrimitive } from '@nexical/generator/engine/primitives/core/import-manager';
import { ExportPrimitive } from '@nexical/generator/engine/primitives/core/export-manager';

describe('Node Coverage - Core Primitives', () => {
  describe('ImportPrimitive', () => {
    it('should normalize legacy mappings and SDK paths', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', '');

      const p1 = new ImportPrimitive({
        moduleSpecifier: '@/lib/api-docs',
        namedImports: ['Doc'],
      });
      p1.create(sourceFile);
      expect(sourceFile.getText()).toContain('from "@/lib/api/api-docs"');

      const p2 = new ImportPrimitive({
        moduleSpecifier: '@modules/user-api/src/sdk/types',
        namedImports: ['User'],
      });
      p2.create(sourceFile);
      expect(sourceFile.getText()).toContain('from "@modules/user-api/src/sdk"');
    });

    it('should merge duplicate imports', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
                import { A } from './utils';
                import { B } from './utils';
            `,
      );

      const utilsDecl = sourceFile.getImportDeclarations()[0];
      const p = new ImportPrimitive({
        moduleSpecifier: './utils',
        namedImports: ['A', 'B'], // Must include all desired imports
      });

      p.update(utilsDecl);

      expect(sourceFile.getText()).toContain('A');
      expect(sourceFile.getText()).toContain('B');
      expect(sourceFile.getImportDeclarations().length).toBe(1);
    });

    it('should move symbols between aliased paths', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
                 import { A } from '@modules/foo';
             `,
      );

      const p = new ImportPrimitive({
        moduleSpecifier: '@modules/bar',
        namedImports: ['A'],
      });

      const newDecl = p.create(sourceFile);
      p.update(newDecl);

      expect(sourceFile.getText()).toContain('import { A } from "@modules/bar"');
      expect(sourceFile.getText()).not.toContain('from "@modules/foo"');
    });

    it('should enforce type-only changes via fallback', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', `import { A } from './a';`);

      const decl = sourceFile.getImportDeclarations()[0];
      const p = new ImportPrimitive({
        moduleSpecifier: './a',
        isTypeOnly: true,
      });

      p.update(decl);
      expect(sourceFile.getText()).toContain('import type { A }');

      const p2 = new ImportPrimitive({
        moduleSpecifier: './a',
        isTypeOnly: false,
      });
      p2.update(decl);
      expect(sourceFile.getText()).not.toContain('import type');
      expect(sourceFile.getText()).toContain('import { A }');
    });

    it('should validate module specifier mismatch', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', `import { A } from './old';`);
      const decl = sourceFile.getImportDeclarations()[0];

      const p = new ImportPrimitive({
        moduleSpecifier: './new',
        namedImports: ['A'],
      });

      const result = p.validate(decl);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('Import module specifier mismatch');
    });
  });

  describe('ExportPrimitive', () => {
    it('should handle wildcard exports', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', `export { A } from './a';`);
      const decl = sourceFile.getExportDeclarations()[0];

      const p = new ExportPrimitive({
        moduleSpecifier: './a',
        exportClause: '*',
      });

      p.update(decl);

      expect(decl.getNamedExports().length).toBe(0);
    });

    it('should validate missing exports', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', `export { A } from './a';`);
      const decl = sourceFile.getExportDeclarations()[0];

      const p = new ExportPrimitive({
        moduleSpecifier: './a',
        exportClause: ['A', 'B'],
      });

      const result = p.validate(decl);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('missing named exports: B');
    });

    it('should cleanup redundant type prefixes', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', `export { type A } from './a';`);

      const decl = sourceFile.getExportDeclarations()[0];
      const p = new ExportPrimitive({
        moduleSpecifier: './a',
        exportClause: ['A'], // We want 'A'
        isTypeOnly: true, // Top level type
      });

      p.update(decl);

      expect(decl.isTypeOnly()).toBe(true);
      expect(decl.getNamedExports()[0].getText()).toBe('A');
    });
  });
});
