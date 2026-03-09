/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SourceFile } from 'ts-morph';
import { createTestProject } from '@nexical/generator-tests/helpers/test-project.js';
import { ExportPrimitive } from '@nexical/generator/engine/primitives/core/export-manager.js';

describe('ExportPrimitive', () => {
  let sourceFile: SourceFile;

  beforeEach(() => {
    const testProject = createTestProject();
    sourceFile = testProject.createSourceFile('test.ts', '');
  });

  it('should find an existing export', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod' });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod' });
    expect(primitive.find(sourceFile)).toBeDefined();
  });

  it('should find an existing type-only export', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod', isTypeOnly: true });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', isTypeOnly: true });
    expect(primitive.find(sourceFile)).toBeDefined();
  });

  it('should create a wildcard export', () => {
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', exportClause: '*' });
    primitive.create(sourceFile);
    expect(sourceFile.getText()).toContain('export * from "./mod";');
  });

  it('should create a named export', () => {
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', exportClause: ['A', 'B'] });
    primitive.create(sourceFile);
    expect(sourceFile.getText()).toContain('export { A, B } from "./mod";');
  });

  it('should update to type-only', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod' });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', isTypeOnly: true });
    const node = sourceFile.getExportDeclarations()[0];
    primitive.update(node);
    expect(node.isTypeOnly()).toBe(true);
  });

  it('should update from type-only', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod', isTypeOnly: true });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', isTypeOnly: false });
    const node = sourceFile.getExportDeclarations()[0];
    primitive.update(node);
    expect(node.isTypeOnly()).toBe(false);
  });

  it('should switch from named to wildcard export', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod', namedExports: ['A'] });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', exportClause: '*' });
    const node = sourceFile.getExportDeclarations()[0];
    primitive.update(node);
    expect(node.getNamedExports()).toHaveLength(0);
  });

  it('should handle wildcard export when no named exports exist', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod', isTypeOnly: true });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', exportClause: '*' });
    const node = sourceFile.getExportDeclarations()[0];
    primitive.update(node); // node.getNamedExports().length === 0
    expect(node.getNamedExports()).toHaveLength(0);
  });

  it('should add missing named exports', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod', namedExports: ['A'] });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', exportClause: ['A', 'B'] });
    const node = sourceFile.getExportDeclarations()[0];
    primitive.update(node);
    const names = node.getNamedExports().map((ne) => ne.getName());
    expect(names).toContain('A');
    expect(names).toContain('B');
  });

  it('should cleanup duplicate named exports', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod', namedExports: ['A', 'A'] });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', exportClause: ['A'] });
    const node = sourceFile.getExportDeclarations()[0];
    primitive.update(node);
    expect(node.getNamedExports()).toHaveLength(1);
  });

  it('should cleanup "type" prefix in named exports when parent is type-only', () => {
    // export type { type A } from './mod' -> export type { A } from './mod'
    sourceFile.addExportDeclaration({
      moduleSpecifier: './mod',
      isTypeOnly: true,
      namedExports: [{ name: 'A', isTypeOnly: true }],
    });
    const primitive = new ExportPrimitive({
      moduleSpecifier: './mod',
      isTypeOnly: true,
      exportClause: ['A'],
    });
    const node = sourceFile.getExportDeclarations()[0];
    primitive.update(node);
    expect(node.getNamedExports()[0].getText()).toBe('A');
  });

  it('should leave named exports alone if they do not have type prefix when parent is type-only', () => {
    sourceFile.addExportDeclaration({
      moduleSpecifier: './mod',
      isTypeOnly: true,
      namedExports: [{ name: 'A' }], // No type prefix
    });
    const primitive = new ExportPrimitive({
      moduleSpecifier: './mod',
      isTypeOnly: true,
      exportClause: ['A'],
    });
    const node = sourceFile.getExportDeclarations()[0];
    primitive.update(node);
    expect(node.getNamedExports()[0].getText()).toBe('A');
  });

  it('should cleanup "type" prefix in named exports when parent is type-only and duplicate exists', () => {
    // If it has { type A, A }
    sourceFile.addExportDeclaration({
      moduleSpecifier: './mod',
      isTypeOnly: true,
      namedExports: [{ name: 'A', isTypeOnly: true }, { name: 'A' }],
    });
    const primitive = new ExportPrimitive({
      moduleSpecifier: './mod',
      isTypeOnly: true,
      exportClause: ['A'],
    });
    const node = sourceFile.getExportDeclarations()[0];
    primitive.update(node);
    // One 'A' remains
    expect(node.getNamedExports()).toHaveLength(1);
    expect(node.getNamedExports()[0].getText()).toBe('A');
  });

  it('should validate named exports successfully when none are missing', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod', namedExports: ['A', 'B'] });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', exportClause: ['A'] });
    const node = sourceFile.getExportDeclarations()[0];
    const result = primitive.validate(node);
    expect(result.valid).toBe(true);
  });

  it('should validate named exports', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod', namedExports: ['A'] });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', exportClause: ['A', 'B'] });
    const node = sourceFile.getExportDeclarations()[0];
    const result = primitive.validate(node);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('missing named exports: B');
  });

  it('should validate type-only mismatch', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod', isTypeOnly: false });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', isTypeOnly: true });
    const node = sourceFile.getExportDeclarations()[0];
    const result = primitive.validate(node);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('type-only mismatch');
  });

  it('should fallback to regex replacement for type-only (true)', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod' });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', isTypeOnly: true });
    const node = sourceFile.getExportDeclarations()[0];

    // Mock ts-morph failure
    let calls = 0;
    vi.spyOn(node, 'isTypeOnly').mockImplementation(() => {
      calls++;
      // Return false for first two checks (before and after setIsTypeOnly)
      return calls > 2 ? true : false;
    });
    vi.spyOn(node, 'setIsTypeOnly').mockImplementation(() => {
      return node as unknown as import('ts-morph').ExportDeclaration;
    });

    primitive.update(node);
    expect(node.getText()).toContain('export type * from "./mod"');
  });

  it('should fallback to regex replacement for type-only (false)', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod', isTypeOnly: true });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', isTypeOnly: false });
    const node = sourceFile.getExportDeclarations()[0];

    // Mock ts-morph failure
    let calls = 0;
    vi.spyOn(node, 'isTypeOnly').mockImplementation(() => {
      calls++;
      // Return true for first two checks (before and after setIsTypeOnly)
      return calls > 2 ? false : true;
    });
    vi.spyOn(node, 'setIsTypeOnly').mockImplementation(() => {
      return node as unknown as import('ts-morph').ExportDeclaration;
    });

    primitive.update(node);
    expect(node.getText()).toBe('export * from "./mod";');
  });

  it('should fallback without replacement if text does not match export/export type', () => {
    sourceFile.addExportDeclaration({ moduleSpecifier: './mod', isTypeOnly: true });
    const primitive = new ExportPrimitive({ moduleSpecifier: './mod', isTypeOnly: false });
    const node = sourceFile.getExportDeclarations()[0];

    // Mock ts-morph failure
    let calls = 0;
    vi.spyOn(node, 'isTypeOnly').mockImplementation(() => {
      calls++;
      return calls > 2 ? false : true;
    });
    vi.spyOn(node, 'setIsTypeOnly').mockImplementation(() => {
      return node as unknown as import('ts-morph').ExportDeclaration;
    });

    // Stub getText to NOT include 'export type' so it hits the implicit else
    vi.spyOn(node, 'getText').mockReturnValue('something else');

    primitive.update(node);
  });
});
