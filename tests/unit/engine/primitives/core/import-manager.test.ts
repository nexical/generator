/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { SourceFile } from 'ts-morph';
import { createTestProject } from '@nexical/generator-tests/helpers/test-project';
import { ImportPrimitive } from '@nexical/generator/engine/primitives/core/import-manager';
import { Normalizer } from '@nexical/generator/utils/normalizer';

describe('ImportPrimitive', () => {
  let sourceFile: SourceFile;

  beforeEach(() => {
    const testProject = createTestProject();
    sourceFile = testProject.createSourceFile('test.ts', '');
  });

  it('should normalize module specifiers', () => {
    expect(Normalizer.normalizeImport('@/lib/utils.ts')).toBe('@/lib/core/utils.ts');
    expect(Normalizer.normalizeImport('@modules/user-api/src/sdk/types.ts')).toBe(
      '@modules/user-api/src/sdk',
    );
  });

  it('should find an existing import with normalization', () => {
    sourceFile.addImportDeclaration({ moduleSpecifier: '@/lib/utils.js' });
    const primitive = new ImportPrimitive({ moduleSpecifier: '@/lib/core/utils.js' });
    expect(primitive.find(sourceFile)).toBeDefined();
  });

  it('should deduplicate imports from the same module', () => {
    sourceFile.addImportDeclaration({ moduleSpecifier: '@/lib/core/utils', namedImports: ['A'] });
    sourceFile.addImportDeclaration({ moduleSpecifier: '@/lib/core/utils', namedImports: ['B'] });
    const primitive = new ImportPrimitive({
      moduleSpecifier: '@/lib/core/utils',
      namedImports: ['A', 'B'],
    });

    const node = sourceFile.getImportDeclarations()[0];
    primitive.update(node);

    expect(sourceFile.getImportDeclarations()).toHaveLength(1);
    const named = sourceFile
      .getImportDeclarations()[0]
      .getNamedImports()
      .map((ni) => ni.getText());
    expect(named).toContain('A');
    expect(named).toContain('B');
  });

  it('should remove duplicate symbols from similar paths', () => {
    sourceFile.addImportDeclaration({ moduleSpecifier: '@modules/other', namedImports: ['Dupe'] });
    const primitive = new ImportPrimitive({
      moduleSpecifier: '@modules/target',
      namedImports: ['Dupe'],
    });

    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: '@modules/target',
      namedImports: ['Dupe'],
    });
    primitive.update(node);

    const otherImport = sourceFile.getImportDeclaration(
      (d) => d.getModuleSpecifierValue() === '@modules/other',
    );
    expect(otherImport).toBeUndefined(); // removed because it became empty
  });

  it('should enforce type-only', () => {
    const node = sourceFile.addImportDeclaration({ moduleSpecifier: './mod', namedImports: ['A'] });
    const primitive = new ImportPrimitive({
      moduleSpecifier: './mod',
      isTypeOnly: true,
      namedImports: ['A'],
    });
    primitive.update(node);
    expect(node.isTypeOnly()).toBe(true);
  });

  it('should manage named imports (add/remove)', () => {
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: './mod',
      namedImports: ['A', 'C'],
    });
    const primitive = new ImportPrimitive({ moduleSpecifier: './mod', namedImports: ['A', 'B'] });
    primitive.update(node);

    const named = node.getNamedImports().map((ni) => ni.getName());
    expect(named).toContain('A');
    expect(named).toContain('B');
    expect(named).not.toContain('C');
  });

  it('should remove import if empty after update', () => {
    const node = sourceFile.addImportDeclaration({ moduleSpecifier: './mod', namedImports: ['A'] });
    const primitive = new ImportPrimitive({ moduleSpecifier: './mod', namedImports: [] });
    primitive.update(node);
    expect(sourceFile.getImportDeclarations()).toHaveLength(0);
  });

  it('should validate correctly', () => {
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: '@modules/other',
      defaultImport: 'Old',
      namedImports: ['A'],
    });
    const primitive = new ImportPrimitive({
      moduleSpecifier: './mod',
      defaultImport: 'New',
      namedImports: ['A', 'B'],
      isTypeOnly: true,
    });

    const result = primitive.validate(node);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(4);
    expect(result.issues[0]).toContain('module specifier mismatch');
    expect(result.issues[1]).toContain('default import mismatch');
    expect(result.issues[2]).toContain('missing named imports: B');
    expect(result.issues[3]).toContain('type-only mismatch');
  });

  it('should preserve module specifier extension', () => {
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: './mod.js',
      namedImports: ['A'],
    });
    const primitive = new ImportPrimitive({ moduleSpecifier: './mod.js', namedImports: ['A'] });
    primitive.update(node);
    expect(node.getModuleSpecifierValue()).toBe('./mod.js');
  });

  it('should cleanup "type" prefix in named imports when parent is type-only', () => {
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: './mod',
      isTypeOnly: true,
      namedImports: [{ name: 'A', isTypeOnly: true }],
    });
    const primitive = new ImportPrimitive({
      moduleSpecifier: './mod',
      isTypeOnly: true,
      namedImports: ['A'],
    });
    primitive.update(node);
    expect(node.getNamedImports()[0].getText()).toBe('A');
  });
});
