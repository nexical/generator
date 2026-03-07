import { describe, it, expect } from 'vitest';
import { Reconciler } from '../../../src/engine/reconciler.js';
import { Project } from 'ts-morph';
import { type FileDefinition } from '../../../src/engine/types.js';

describe('Reconciler - Coverage Boost', () => {
  it('should prune unused elements in GENERATED files', () => {
    const project = new Project();
    const file = project.createSourceFile(
      'test.ts',
      `
// GENERATED CODE
import { A } from './a';
class OldClass {}
interface OldInterface {}
enum OldEnum { A }
function oldFunc() {}
type OldType = string;
const oldVar = 1;
        `,
    );

    // Empty definition should prune everything
    const definition: FileDefinition = {
      header: '// GENERATED CODE',
      imports: [],
      classes: [],
      interfaces: [],
      enums: [],
      functions: [],
      types: [],
      variables: [],
      exports: [],
    };

    Reconciler.reconcile(file, definition);

    expect(file.getClasses().length).toBe(0);
    expect(file.getInterfaces().length).toBe(0);
    expect(file.getEnums().length).toBe(0);
    expect(file.getFunctions().length).toBe(0);
    expect(file.getTypeAliases().length).toBe(0);
    expect(file.getVariableStatements().length).toBe(0);
    expect(file.getImportDeclarations().length).toBe(0);
  });

  it('should NOT prune in non-GENERATED files', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', 'class UserClass {}');

    const definition: FileDefinition = {
      classes: [], // empty
    };

    Reconciler.reconcile(file, definition);
    expect(file.getClasses().length).toBe(1); // Should still be there
  });

  it('should handle Namespace (ModuleDeclaration) reconciliation', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', 'export namespace MyMod {}');
    const ns = file.getModule('MyMod')!;

    const definition: FileDefinition = {
      interfaces: [{ name: 'NewIface', properties: [] }],
    };

    Reconciler.reconcile(ns, definition);
    expect(ns.getInterfaces().length).toBe(1);
    expect(ns.getInterface('NewIface')).toBeDefined();
  });

  it('should handle raw statements with smart skipping (isGenerated: false)', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', 'export function existing() {}');

    const definition: FileDefinition = {
      statements: [
        'export function existing() {\n  /* block content changed */\n}', // Multi-line to ensure signature match
        'export function newlyAdded() {}',
      ] as unknown as import('../../../src/engine/types.js').StatementConfig[],
    };

    Reconciler.reconcile(file, definition);
    const text = file.getFullText();
    expect(text).toContain('existing');
    expect(text).toContain('newlyAdded');
    expect(text).not.toContain('block content changed');
  });

  it('should handle defineApi smart skipping', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', 'defineApi({\n  name: "existing"\n})');

    const definition: FileDefinition = {
      statements: [
        'defineApi({\n  name: "existing",\n  change: true\n})',
        'const newlyAdded = 1;',
      ] as unknown as import('../../../src/engine/types.js').StatementConfig[],
    };

    Reconciler.reconcile(file, definition);
    expect(file.getFullText()).toContain('newlyAdded');
    expect(file.getFullText()).not.toContain('change: true');
  });

  it('should handle describe/it block skipping', () => {
    const project = new Project();
    const file = project.createSourceFile('test.test.ts', "describe('test suite', () => {});");

    const definition: FileDefinition = {
      statements: [
        "describe('test suite', () => { console.log('extra'); });",
        "it('new test', () => {});",
      ] as any,
    };

    Reconciler.reconcile(file, definition);
    expect(file.getFullText()).toContain('new test');
    expect(file.getFullText()).not.toContain('extra');
  });

  it('should handle role and permission reconciliation', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', '// GENERATED CODE');

    const definition: FileDefinition = {
      role: { name: 'Admin', definition: { permissions: ['*'] } },
      permissions: { 'user:read': { description: 'Read user' } },
      rolePermissions: { Admin: ['user:read'] },
    };

    Reconciler.reconcile(file, definition);
    expect(file.getClass('AdminRole')).toBeDefined();
    expect(file.getVariableStatement('PermissionRegistry')).toBeDefined();
  });

  it('should hoist header to top if missing or different', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', "import { x } from 'y';");

    const definition: FileDefinition = {
      header: '// NEW HEADER',
      imports: [{ moduleSpecifier: 'y', namedImports: ['x'] }],
    };

    Reconciler.reconcile(file, definition);
    expect(file.getFullText().startsWith('// NEW HEADER')).toBe(true);
  });

  it('should prune elements when target is not empty', () => {
    const project = new Project();
    const file = project.createSourceFile(
      'test.ts',
      `
// GENERATED CODE
enum Old { A }
function oldFunc() {}
type OldT = string;
        `,
    );
    const definition: FileDefinition = {
      header: '// GENERATED CODE',
      enums: [{ name: 'New', members: [] }],
      functions: [{ name: 'newFunc', statements: [] }],
      types: [{ name: 'NewT', type: 'string' }],
    };
    Reconciler.reconcile(file, definition);
    expect(file.getEnum('Old')).toBeUndefined();
    expect(file.getFunction('oldFunc')).toBeUndefined();
    expect(file.getTypeAlias('OldT')).toBeUndefined();
  });
});
