/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { createTestProject } from '@nexical/generator-tests/helpers/test-project';
import { FunctionPrimitive } from '@nexical/generator/engine/primitives/nodes/function';

describe('FunctionPrimitive', () => {
  it('should create a new function', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', '');

    const primitive = new FunctionPrimitive({
      name: 'testFunction',
      isExported: true,
      returnType: 'void',
      parameters: [{ name: 'arg', type: 'string' }],
      statements: ['console.log(arg);'],
    });

    primitive.ensure(sourceFile);

    const func = sourceFile.getFunction('testFunction');
    expect(func).toBeDefined();
    expect(func?.isExported()).toBe(true);
    expect(func?.getReturnType().getText()).toBe('void');
    expect(func?.getParameters()[0].getName()).toBe('arg');
  });

  it('should update an existing function (basic props)', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'export function testFunction() {}');

    const primitive = new FunctionPrimitive({
      name: 'testFunction',
      isAsync: true,
      returnType: 'Promise<string>',
      statements: ['return "updated";'],
      overwriteBody: true,
    });

    primitive.ensure(sourceFile);

    const func = sourceFile.getFunction('testFunction');
    expect(func?.isAsync()).toBe(true);
    expect(func?.getReturnType().getText()).toBe('Promise<string>');
    expect(func?.getBodyText()).toContain('return "updated";');
  });

  it('should reconcile parameters', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'function test(oldName: any) {}');

    const primitive = new FunctionPrimitive({
      name: 'test',
      parameters: [
        { name: 'newName', type: 'string' }, // Rename & Type change
        { name: 'added', type: 'number' }, // Add
      ],
    });

    primitive.ensure(sourceFile);

    const func = sourceFile.getFunction('test')!;
    expect(func.getParameters()[0].getName()).toBe('newName');
    expect(func.getParameters()[0].getTypeNode()?.getText()).toBe('string');
    expect(func.getParameters()[1].getName()).toBe('added');
    expect(func.getParameters()[1].getTypeNode()?.getText()).toBe('number');
  });

  it('should reconcile body statements (append new string)', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      'function test() { console.log("initial"); }',
    );

    const primitive = new FunctionPrimitive({
      name: 'test',
      statements: ['console.log("appended");'],
    });

    primitive.ensure(sourceFile);

    const body = sourceFile.getFunction('test')!.getBodyText();
    expect(body).toContain('console.log("initial");');
    expect(body).toContain('console.log("appended");');
  });

  it('should skip existing identical string statements', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      'function test() { console.log("exists"); }',
    );

    const primitive = new FunctionPrimitive({
      name: 'test',
      statements: ['console.log("exists");'],
    });

    primitive.ensure(sourceFile);

    const func = sourceFile.getFunction('test')!;
    // Should not duplicate
    expect(func.getBodyText()?.match(/console\.log\("exists"\);/g)).toHaveLength(1);
  });

  it('should enforce non-default variable declaration', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      'function test() { const foo = "old"; }',
    );

    const primitive = new FunctionPrimitive({
      name: 'test',
      statements: [
        {
          kind: 'variable',
          declarationKind: 'const',
          declarations: [{ name: 'foo', initializer: '"enforced"' }],
          isDefault: false,
        },
      ],
    });

    primitive.ensure(sourceFile);
    expect(sourceFile.getFunction('test')!.getBodyText()).toContain('const foo = "enforced"');
  });

  it('should respect user changes for default variable declaration', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      'function test() { const foo = "user-changed"; }',
    );

    const primitive = new FunctionPrimitive({
      name: 'test',
      statements: [
        {
          kind: 'variable',
          declarationKind: 'const',
          declarations: [{ name: 'foo', initializer: '"default"' }],
          isDefault: true,
        },
      ],
    });

    primitive.ensure(sourceFile);
    expect(sourceFile.getFunction('test')!.getBodyText()).toContain('const foo = "user-changed"');
  });

  it('should reconcile if statement by condition', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      'function test() { if (check) { old(); } }',
    );

    const primitive = new FunctionPrimitive({
      name: 'test',
      statements: [
        {
          kind: 'if',
          condition: 'check',
          then: ['new();'],
          isDefault: false,
        },
      ],
    });

    primitive.ensure(sourceFile);
    const body = sourceFile.getFunction('test')!.getBodyText();
    expect(body.replace(/\s+/g, ' ')).toContain('if (check) { new(); }');
  });

  it('should validate correctly', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      'async function test(): Promise<void> {}',
    );
    const func = sourceFile.getFunction('test')!;

    const primitive = new FunctionPrimitive({
      name: 'test',
      isAsync: false,
      returnType: 'string',
    });

    const result = primitive.validate(func);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('async modifier mismatch'))).toBe(true);
    expect(result.issues.some((i) => i.includes('return type mismatch'))).toBe(true);
  });
});
