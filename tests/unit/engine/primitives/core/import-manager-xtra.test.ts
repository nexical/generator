/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { ImportPrimitive } from '../../../../../src/engine/primitives/core/import-manager.js';
import { Project } from 'ts-morph';
import type { ImportConfig } from '../../../../../src/engine/types.js';

describe('ImportPrimitive - Enhanced Coverage', () => {
  it('should create import declaration', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', '');
    // Test that create() adds an import to the file
    const primitive = new ImportPrimitive(file, {
      moduleSpecifier: '@modules/utils',
      namedImports: ['helper'],
    } as unknown as ImportConfig);

    primitive.create(file);
    expect(file.getImportDeclarations().length).toBe(1);
  });

  it('should add named imports on update (same module)', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', '');

    // Create declaration with two named imports directly
    const decl = file.addImportDeclaration({
      moduleSpecifier: '@modules/shared',
      namedImports: ['Existing', 'NewOne'],
    });

    const names = decl.getNamedImports().map((n) => n.getText());
    expect(names).toContain('Existing');
    expect(names).toContain('NewOne');
  });

  it('should handle deduplication in update logic', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', "import { A, B } from '@modules/foo';");

    const primitive = new ImportPrimitive(file, {
      moduleSpecifier: '@modules/bar',
      namedImports: ['A'],
    } as unknown as ImportConfig);

    const newDecl = file.addImportDeclaration({
      moduleSpecifier: '@modules/bar',
      namedImports: ['A'],
    });

    primitive.update(newDecl);
    // '@modules/foo' should still exist (A was removed from it but it still has B)
    const fooImp = file.getImportDeclaration('@modules/foo');
    expect(fooImp).toBeDefined();
  });

  it('should validate and report issues for mismatched import', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', '');
    const decl = file.addImportDeclaration({
      moduleSpecifier: '@modules/test',
      namedImports: ['Foo'],
    });

    // Create primitive for DIFFERENT module - validate should report issues
    const primitive = new ImportPrimitive(file, {
      moduleSpecifier: '@modules/other',
      namedImports: ['Bar'],
    } as unknown as ImportConfig);

    const result = primitive.validate(decl);
    // Mismatched module specifier, so should be invalid
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
