/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { Reconciler } from '../../../src/engine/reconciler.js';
import { type FileDefinition } from '../../../src/engine/types.js';

describe('Reconciler - Exhaustive Coverage', () => {
  it('should handle non-SourceFile (Namespace) path and branches', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', 'namespace M {}');
    const ns = file.getModule('M')!;

    const definition: FileDefinition = {
      interfaces: [{ name: 'I' }],
    };

    Reconciler.reconcile(ns, definition);
    expect(ns.getInterface('I')).toBeDefined();
  });

  it('should cover all pruning branches in GENERATED files', () => {
    const project = new Project();
    const file = project.createSourceFile(
      'test.ts',
      `
      // GENERATED CODE
      class C {}
      interface I {}
      enum E { A }
      function f() {}
      type T = string;
      const v = 1;
    `,
    );

    const definition: FileDefinition = {
      header: '// GENERATED CODE',
      classes: [{ name: 'NewC' }],
      interfaces: [{ name: 'NewI' }],
      enums: [{ name: 'NewE', members: [] }],
      functions: [{ name: 'NewF' }],
      types: [{ name: 'NewT', type: 'string' }],
      variables: [{ name: 'NewV', initializer: '1' }],
    };

    Reconciler.reconcile(file, definition);

    expect(file.getClass('C')).toBeUndefined();
    expect(file.getInterface('I')).toBeUndefined();
    expect(file.getEnum('E')).toBeUndefined();
    expect(file.getFunction('f')).toBeUndefined();
    expect(file.getTypeAlias('T')).toBeUndefined();
    expect(file.getVariableStatement('v')).toBeUndefined();
  });

  it('should cover remaining branches in reconcile', () => {
    const project = new Project();
    const file = project.createSourceFile(
      'test.ts',
      '// INITIAL GENERATED CODE\nimport { X } from "Y";\n',
    );

    const definition: FileDefinition = {
      header: '// INITIAL GENERATED CODE',
      statements: ['', 'import { X } from "Y";'] as unknown[],
    };

    Reconciler.reconcile(file, definition);
    expect(file.getImportDeclarations().length).toBe(1);

    const genFile = project.createSourceFile(
      'gen.ts',
      '// GENERATED CODE\nimport { Old } from "old";\n',
    );
    Reconciler.reconcile(genFile, {
      header: '// GENERATED CODE',
      imports: [{ moduleSpecifier: 'new' }],
    });
    expect(genFile.getImportDeclarations().length).toBe(1);
    expect(genFile.getImportDeclarations()[0].getModuleSpecifierValue()).toBe('new');
  });

  it('should cover validate success and invalid nodes', () => {
    const project = new Project();
    const file = project.createSourceFile(
      'test.ts',
      `
// HEADER
import { A } from './a';
export { B } from './b';
class C { p: string; constructor(a: number) {} }
export function MyComp() { return null; }
export class AdminRole {}
export const PermissionRegistry = {};
export enum MyEnum { A }
export type MyType = string;
export const myVar = 1;
    `,
    );

    const definition: FileDefinition = {
      header: '// HEADER',
      imports: [{ moduleSpecifier: './a', namedImports: ['B'] }],
      exports: [{ moduleSpecifier: './b', exportClause: ['C'] }],
      classes: [{ name: 'C', properties: [{ name: 'p', type: 'number' }] }],
      enums: [{ name: 'MyEnum', members: [{ name: 'B', value: 'B' }] }],
      functions: [{ name: 'OtherFunc' }],
      types: [{ name: 'MyType', type: 'number' }],
      variables: [{ name: 'myVar', initializer: '2' }],
      components: [{ name: 'MyComp', render: { raw: '<div></div>', getNodes: () => [] } }],
      role: { name: 'Admin', definition: { permissions: ['p1'] } },
      permissions: { p1: { description: 'd' } },
      modules: [{ name: 'M' }],
    };

    const result = Reconciler.validate(file, definition);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues).toContain("Module 'M' is missing.");
    expect(result.issues).toContain("Function 'OtherFunc' is missing.");
  });

  it('should cover missing components, roles, and permissions in validate', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', '// HEADER\n');

    const definition: FileDefinition = {
      header: '// HEADER',
      components: [{ name: 'Comp', render: { raw: '', getNodes: () => [] } }],
      role: { name: 'TestRole', definition: { permissions: [] } },
      permissions: { p: { description: 'd' } },
      functions: [{ name: 'f' }],
      types: [{ name: 'T', type: 'string' }],
      variables: [{ name: 'v', initializer: '1' }],
      modules: [{ name: 'M' }],
      interfaces: [{ name: 'I' }],
      enums: [{ name: 'E', members: [] }],
    };

    const result = Reconciler.validate(file, definition);
    const issues = result.issues;
    expect(result.valid).toBe(false);
    expect(issues).toContain("Component 'Comp' is missing.");
    expect(issues).toContain("Role 'TestRole' is missing.");
    expect(issues).toContain('PermissionRegistry is missing.');
    expect(issues).toContain("Function 'f' is missing.");
    expect(issues).toContain("Type 'T' is missing.");
    expect(issues).toContain("Variable 'v' is missing.");
    expect(issues).toContain("Module 'M' is missing.");
    expect(issues).toContain("Interface 'I' is missing.");
    expect(issues).toContain("Enum 'E' is missing.");
  });

  it('should exhaust signature-based skipping', () => {
    const project = new Project();
    const file = project.createSourceFile(
      'test.ts',
      '// GENERATED CODE\nclass C {\n  // user content\n}',
    );
    const definition: FileDefinition = {
      header: '// GENERATED CODE',
      classes: [{ name: 'C' }],
      statements: ['class C {\n  // generator content\n}'] as unknown[],
    };
    Reconciler.reconcile(file, definition);
    expect(file.getFullText()).not.toContain('generator content');
    expect(file.getFullText()).toContain('user content');
  });

  it('should handle header removal and replacement more thoroughly', () => {
    const content =
      '// INITIAL GENERATED CODE\n// GENERATED CODE\n// This file is automatically generated by something\n// Any manual changes will be overwritten\nconst x = 1;';
    const result = Reconciler.hoistHeader(content, '// NEW HEADER');
    expect(result.replace(/\r/g, '')).toBe('// NEW HEADER\nconst x = 1;');
  });

  it('should handle non-SourceFile header insertion (line 337)', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', 'namespace M { const x = 1; }');
    const ns = file.getModule('M')!;
    const definition: FileDefinition = { header: '// HEADER' };
    Reconciler.reconcile(ns, definition);
    expect(ns.getFullText()).toContain('// HEADER');
  });

  it('should cover static hoistHeader edge cases', () => {
    expect(Reconciler.hoistHeader('const x = 1;', '// HEADER')).toBe('// HEADER\nconst x = 1;');
    expect(Reconciler.hoistHeader('// HEADER\nconst x = 1;', '// HEADER')).toBe(
      '// HEADER\nconst x = 1;',
    );
  });

  it('should handle non-Error instance in catch', () => {
    try {
      const _internalProject = new Project();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Reconciler.reconcile(null as unknown as any, {});
    } catch (e: unknown) {
      expect((e as Error).message).toContain('Failed to reconcile file: namespace');
    }
  });

  it('should cover branch for non-raw StatementConfig (line 248)', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', '');
    const definition: FileDefinition = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      statements: [{ notRaw: 'true' } as unknown as { raw: string; getNodes: () => any[] }],
    };
    Reconciler.reconcile(file, definition);
    expect(file.getFullText()).toBe('');
  });

  it('should handle reconcile without addStatements capability', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', 'class C {}');
    const classNode = file.getClass('C')!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Reconciler.reconcile(classNode as unknown as any, { statements: ['// x'] as unknown[] });
  });

  it('should handle reconcile with invalid sourceFile', () => {
    // @ts-expect-error Testing invalid input
    expect(() => Reconciler.reconcile(null, {})).toThrow();
    // @ts-expect-error Testing invalid input
    expect(() => Reconciler.reconcile({}, {})).not.toThrow();
  });

  it('should cover Normalizer legacy mappings and SDK paths', () => {
    const project = new Project();
    const file = project.createSourceFile(
      'test.ts',
      '// GENERATED CODE\nimport { X } from "@/lib/db.ts";\nimport { Y } from "foo/src/sdk/bar.ts";',
    );

    // This should hit Normalizer.normalizeImport legacy mappings and SDK paths
    const definition: FileDefinition = {
      header: '// GENERATED CODE',
      imports: [{ moduleSpecifier: '@/lib/db.ts' }, { moduleSpecifier: 'foo/src/sdk/bar.ts' }],
    };

    Reconciler.reconcile(file, definition);
    expect(file.getImportDeclarations().length).toBe(2);
  });
});
