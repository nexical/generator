/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SourceFile } from 'ts-morph';
import { createTestProject } from '../../../helpers/test-project.js';
import { ImportPrimitive } from '../../../../../src/engine/primitives/core/import-manager.js';
import { Normalizer } from '../../../../../src/utils/normalizer.js';

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

  it('should create an import with a header', () => {
    const primitive = new ImportPrimitive({
      moduleSpecifier: './mod',
      header: '// New Header',
    });
    primitive.create(sourceFile);
    expect(sourceFile.getFullText()).toContain('// New Header');
  });

  it('should create an import without a header', () => {
    const primitive = new ImportPrimitive({ moduleSpecifier: './mod-no-header' });
    primitive.create(sourceFile);
    expect(sourceFile.getText()).toContain('import "./mod-no-header";');
  });

  it('should find an existing import with normalization', () => {
    sourceFile.addImportDeclaration({ moduleSpecifier: '@/lib/utils.js' });
    const primitive = new ImportPrimitive({ moduleSpecifier: '@/lib/core/utils.js' });
    expect(primitive.find(sourceFile)).toBeDefined();
  });

  it('should update module specifier if node value differs from normalized target', () => {
    const node = sourceFile.addImportDeclaration({ moduleSpecifier: './mod.js' });
    const primitive = new ImportPrimitive({ moduleSpecifier: './mod' });
    vi.spyOn(Normalizer, 'normalizeImport').mockReturnValue('./mod');
    primitive.update(node);
    expect(node.getModuleSpecifierValue()).toBe('./mod');
    vi.restoreAllMocks();
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

  it('should merge named imports when deduplicating from same module', () => {
    sourceFile.addImportDeclaration({ moduleSpecifier: '@/lib/merge', namedImports: ['A'] });
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: '@/lib/merge',
      namedImports: ['B', 'C'],
    });
    const primitive = new ImportPrimitive({
      moduleSpecifier: '@/lib/merge',
      namedImports: ['A', 'B', 'C'],
    });
    primitive.update(node);

    expect(sourceFile.getImportDeclarations()).toHaveLength(1);
    const named = sourceFile
      .getImportDeclarations()[0]
      .getNamedImports()
      .map((ni) => ni.getText());
    expect(named).toContain('A');
    expect(named).toContain('B');
    expect(named).toContain('C');
  });

  it('should deduplicate imports from same module when existing has no named imports', () => {
    sourceFile.addImportDeclaration({ moduleSpecifier: '@/lib/empty' });
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: '@/lib/empty',
      defaultImport: 'Def',
    });
    const primitive = new ImportPrimitive({ moduleSpecifier: '@/lib/empty', defaultImport: 'Def' });
    primitive.update(node);
    expect(sourceFile.getImportDeclarations()).toHaveLength(1);
  });

  it('should deduplicate imports from same module when existing has no missing named imports', () => {
    sourceFile.addImportDeclaration({ moduleSpecifier: '@/lib/exact', namedImports: ['A'] });
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: '@/lib/exact',
      namedImports: ['A', 'B'],
    });
    const primitive = new ImportPrimitive({
      moduleSpecifier: '@/lib/exact',
      namedImports: ['A', 'B'],
    });
    primitive.update(node);
    expect(sourceFile.getImportDeclarations()).toHaveLength(1);
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

  it('should retain existing import if not empty after removing duplicate symbols', () => {
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@modules/other2',
      defaultImport: 'Def',
      namedImports: ['Dupe2'],
    });
    const primitive = new ImportPrimitive({
      moduleSpecifier: '@modules/target2',
      namedImports: ['Dupe2'],
    });

    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: '@modules/target2',
      namedImports: ['Dupe2'],
    });
    primitive.update(node);

    const otherImport = sourceFile.getImportDeclaration(
      (d) => d.getModuleSpecifierValue() === '@modules/other2',
    );
    expect(otherImport).toBeDefined(); // retained because it has defaultImport
    expect(otherImport?.getDefaultImport()?.getText()).toBe('Def');
  });

  it('should ignore overlapping symbols if one module is aliased and the other is not', () => {
    sourceFile.addImportDeclaration({ moduleSpecifier: './other', namedImports: ['Dupe'] });
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: '@modules/target',
      namedImports: ['Dupe'],
    });
    const primitive = new ImportPrimitive({
      moduleSpecifier: '@modules/target',
      namedImports: ['Dupe'],
    });
    primitive.update(node);

    // Other import should STILL exist with 'Dupe' because they have different aliasing schemes
    const otherImport = sourceFile.getImportDeclaration(
      (d) => d.getModuleSpecifierValue() === './other',
    );
    expect(otherImport).toBeDefined();
    expect(otherImport?.getNamedImports()[0].getText()).toBe('Dupe');
  });

  it('should not remove symbols from similar paths if they are not overlapping', () => {
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@modules/other',
      namedImports: ['Dupe', 'NotDupe'],
    });
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: '@modules/target',
      namedImports: ['Dupe'],
    });
    const primitive = new ImportPrimitive({
      moduleSpecifier: '@modules/target',
      namedImports: ['Dupe'],
    });

    primitive.update(node);

    const otherImport = sourceFile.getImportDeclaration(
      (d) => d.getModuleSpecifierValue() === '@modules/other',
    );
    expect(otherImport).toBeDefined();
    expect(otherImport?.getNamedImports().map((ni) => ni.getText())).toContain('NotDupe');
    expect(otherImport?.getNamedImports().map((ni) => ni.getText())).not.toContain('Dupe');
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

  it('should validate correctly without issues', () => {
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: './mod-valid',
      defaultImport: 'Def',
      namedImports: ['A'],
      isTypeOnly: true,
    });
    const primitive = new ImportPrimitive({
      moduleSpecifier: './mod-valid',
      defaultImport: 'Def',
      namedImports: ['A'],
      isTypeOnly: true,
    });
    const result = primitive.validate(node);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should validate correctly without default import in config', () => {
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: './mod-no-def',
      namedImports: ['A'],
    });
    const primitive = new ImportPrimitive({ moduleSpecifier: './mod-no-def', namedImports: ['A'] });
    const result = primitive.validate(node);
    expect(result.valid).toBe(true);
  });

  it('should validate default import correctly (mismatch)', () => {
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: './mod',
      defaultImport: 'Wrong',
    });
    const primitive = new ImportPrimitive({ moduleSpecifier: './mod', defaultImport: 'Def' });
    const result = primitive.validate(node);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('default import mismatch');
  });

  it('should validate default import correctly (missing)', () => {
    const node = sourceFile.addImportDeclaration({ moduleSpecifier: './mod' });
    const primitive = new ImportPrimitive({ moduleSpecifier: './mod', defaultImport: 'Def' });
    const result = primitive.validate(node);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('default import mismatch');
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

  it('should leave named imports alone if they do not have type prefix when parent is type-only', () => {
    const node = sourceFile.addImportDeclaration({
      moduleSpecifier: './mod',
      isTypeOnly: true,
      namedImports: [{ name: 'A' }], // No type prefix
    });
    const primitive = new ImportPrimitive({
      moduleSpecifier: './mod',
      isTypeOnly: true,
      namedImports: ['A'], // Config doesn't have type
    });
    primitive.update(node);
    expect(node.getNamedImports()[0].getText()).toBe('A');
  });

  it('should manage headers', () => {
    const node = sourceFile.addImportDeclaration({ moduleSpecifier: './mod', namedImports: ['A'] });
    const primitive = new ImportPrimitive({
      moduleSpecifier: './mod',
      namedImports: ['A'],
      header: '// My Header',
    });
    primitive.update(node);
    expect(sourceFile.getFullText()).toContain('// My Header');

    // Should not duplicate header
    primitive.update(node);
    const text = sourceFile.getFullText();
    const count = (text.match(/\/\/ My Header/g) || []).length;
    expect(count).toBe(1);
  });

  it('should cleanup duplicate named imports in the source file', () => {
    const node = sourceFile.addImportDeclaration({ moduleSpecifier: './mod' });
    node.addNamedImport('A');
    node.addNamedImport('A'); // Duplicate A
    const primitive = new ImportPrimitive({ moduleSpecifier: './mod', namedImports: ['A'] });
    primitive.update(node);
    expect(node.getNamedImports()).toHaveLength(1);
  });


});
