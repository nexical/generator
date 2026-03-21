import { describe, it, expect, beforeEach } from 'vitest';
import { Reconciler } from '@nexical/generator/engine/reconciler.js';
import { Project, QuoteKind } from 'ts-morph';

describe('Reconciler Extra Coverage', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({
      manipulationSettings: { quoteKind: QuoteKind.Single },
    });
  });

  it('should cover hoistHeader with complex existing content', () => {
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
// PRE-BOILERPLATE
/**
 * SOME DOCS
 */
// @ts-nocheck
import { foo } from 'bar';

// GENERATED CODE
export const a = 1;
`,
    );

    Reconciler.reconcile(sourceFile, {
      header: '// GENERATED CODE - NEW',
      variables: [
        { name: 'a', initializer: '1', declarationKind: 'const', isExported: true },
        { name: 'b', initializer: '2', declarationKind: 'const', isExported: true },
      ],
    });

    const text = sourceFile.getFullText();
    expect(text).toMatch(/\/\/ PRE-BOILERPLATE/);
    // Reconciler might not preserve all comments if they are not part of the same block
    // But it should at least preserve the PRE-BOILERPLATE and the new header
    expect(text).toMatch(/\/\/ GENERATED CODE - NEW/);
    expect(text).toMatch(/export\s+const\s+a\s*=\s*1;/);
    expect(text).toMatch(/export\s+const\s+b\s*=\s*2;/);
  });

  it('should cover validate with various node types', () => {
    const sourceFile = project.createSourceFile(
      'test-validate.ts',
      `
// GENERATED CODE
export interface I { a: string; }
export function f() {}
export enum E { A }
export type T = string;
export const v = 1;

export class C {}
export namespace N {}
`,
    );

    // Reconcile with different nodes to trigger pruning and validation
    Reconciler.reconcile(sourceFile, {
      header: '// GENERATED CODE',
      interfaces: [{ name: 'I', properties: [] }],
      functions: [{ name: 'f', statements: [] }],
      enums: [{ name: 'E', members: [] }],
      types: [{ name: 'T', type: 'number' }],
      variables: [{ name: 'v', initializer: '2' }],
      classes: [{ name: 'C' }],
      modules: [{ name: 'N', variables: [] }],
    });

    const text = sourceFile.getFullText();
    expect(text).toMatch(/export\s+interface\s+I/);
    expect(text).toMatch(/export\s+function\s+f/);
    expect(text).toMatch(/export\s+enum\s+E/);
    expect(text).toMatch(/export\s+type\s+T/);
    expect(text).toMatch(/export\s+const\s+v\s*=\s*2/);
    expect(text).toMatch(/class\s+C/);
    expect(text).toMatch(/namespace\s+N/);
  });

  it('should skip pruning if INITIAL GENERATED CODE is present', () => {
    const sourceFile = project.createSourceFile(
      'test-initial.ts',
      `
// INITIAL GENERATED CODE - DO NOT MODIFY
export const existing = 1;
`,
    );

    Reconciler.reconcile(sourceFile, {
      header: '// GENERATED CODE',
      variables: [{ name: 'newVar', initializer: '2' }],
    });

    const text = sourceFile.getFullText();
    expect(text).toMatch(/const\s+existing\s*=\s*1/);
    expect(text).toMatch(/const\s+newVar\s*=\s*2/);
  });

  it('should cover import merging edge cases', () => {
    const sourceFile = project.createSourceFile(
      'test-imports.ts',
      `
import { a, b } from 'mod';
export const manual = 1;
// GENERATED CODE
console.log(a, b);
`,
    );

    Reconciler.reconcile(sourceFile, {
      header: '// GENERATED CODE',
      imports: [
        { moduleSpecifier: 'mod', namedImports: ['b', 'c'] },
        { moduleSpecifier: 'new-mod', namedImports: ['d'] },
      ],
      statements: ['console.log(a, b, c, d);'], // Use all imports
    });

    const text = sourceFile.getFullText();
    expect(text).toMatch(/import\s*{\s*[abc,\s]+}\s*from\s*['"]mod['"]/);
    expect(text).toMatch(/import\s*{\s*d\s*}\s*from\s*['"]new-mod['"]/);
  });

  it('should handle namespace header reconciliation', () => {
    const sf = project.createSourceFile(
      'test-namespace-header.ts',
      `export namespace N { export const a = 1; }`,
      { overwrite: true },
    );
    const namespaceNode = sf.getModule('N')!; // Use getModule for namespace keyword

    Reconciler.reconcile(
      namespaceNode as unknown as import('@nexical/generator/engine/types.js').NodeContainer,
      {
        header: '// NAMESPACE HEADER',
        statements: [],
      },
    );

    expect(namespaceNode.getText()).toContain('// NAMESPACE HEADER');
  });

  it('should wipe duplicate defineApi blocks in GENERATED files', () => {
    // Reconciler identifies API nodes by the presence of 'defineApi('
    const sf = project.createSourceFile(
      'test-wipe-defineapi.ts',
      `// GENERATED CODE
export const GET = defineApi(async () => {});
export const POST = defineApi(async () => {});
`,
      { overwrite: true },
    );

    Reconciler.reconcile(sf, {
      header: '// GENERATED CODE',
      statements: ['export const NEW = defineApi(async () => {});'],
    });

    const text = sf.getFullText();
    // It should have wiped old ones because it's a generated file and we are adding new ones
    expect(text.match(/defineApi/g)).toHaveLength(1);
    expect(text).toContain('NEW');
  });
});
