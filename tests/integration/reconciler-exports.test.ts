import { describe, it, expect } from 'vitest';
import { createTestProject } from '@nexical/generator-tests/helpers/test-project';
import { Reconciler } from '../../src/engine/reconciler';

describe('Reconciler - Exports', () => {
  it('should reconcile wildcard exports', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', '');

    Reconciler.reconcile(sourceFile, {
      exports: [{ moduleSpecifier: './sub-module', exportClause: '*' }],
    });

    const exports = sourceFile.getExportDeclarations();
    expect(exports).toHaveLength(1);
    expect(exports[0].getModuleSpecifierValue()).toBe('./sub-module');
    expect(exports[0].getNamedExports()).toHaveLength(0);
    // ts-morph normalize might change quotes, but core structure check is enough
  });

  it('should reconcile named exports', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', '');

    Reconciler.reconcile(sourceFile, {
      exports: [{ moduleSpecifier: './utils', exportClause: ['formatDate', 'parseJson'] }],
    });

    const exports = sourceFile.getExportDeclarations();
    expect(exports).toHaveLength(1);
    expect(exports[0].getModuleSpecifierValue()).toBe('./utils');
    const named = exports[0].getNamedExports().map((e) => e.getName());
    expect(named).toContain('formatDate');
    expect(named).toContain('parseJson');
  });

  it('should update existing named exports', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', `export { A } from './mod';`);

    Reconciler.reconcile(sourceFile, {
      exports: [{ moduleSpecifier: './mod', exportClause: ['A', 'B'] }],
    });

    const exports = sourceFile.getExportDeclarations();
    expect(exports).toHaveLength(1);
    const named = exports[0].getNamedExports().map((e) => e.getName());
    expect(named).toContain('A');
    expect(named).toContain('B');
  });

  it('should validate missing exports', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', '');

    const result = Reconciler.validate(sourceFile, {
      exports: [{ moduleSpecifier: './missing', exportClause: '*' }],
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain("Export './missing' is missing.");
  });
});
