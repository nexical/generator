/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { MethodPrimitive } from '@nexical/generator/engine/primitives/nodes/method.js';

describe('Statement Generation', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', 'class TestClass {}');
  });

  it('should generate a variable statement', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new MethodPrimitive({
      name: 'variableTest',
      statements: [
        {
          kind: 'variable',
          declarationKind: 'const',
          declarations: [{ name: 'x', type: 'number', initializer: '10' }],
        },
      ],
    });

    primitive.create(classNode);
    const method = classNode.getMethod('variableTest')!;
    const body = method.getBodyText();
    expect(body).toContain('const x: number = 10;');
  });

  it('should generate a return statement', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new MethodPrimitive({
      name: 'returnTest',
      statements: [
        {
          kind: 'return',
          expression: '"success"',
        },
      ],
    });

    primitive.create(classNode);
    const method = classNode.getMethod('returnTest')!;
    expect(method.getBodyText()).toContain('return "success";');
  });

  it('should generate an expression statement', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new MethodPrimitive({
      name: 'expressionTest',
      statements: [
        {
          kind: 'expression',
          expression: 'console.log("hello")',
        },
      ],
    });

    primitive.create(classNode);
    const method = classNode.getMethod('expressionTest')!;
    expect(method.getBodyText()).toContain('console.log("hello");');
  });

  it('should handle mixed statement types', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new MethodPrimitive({
      name: 'mixedTest',
      statements: [
        {
          kind: 'variable',
          declarationKind: 'let',
          declarations: [{ name: 'count', initializer: '0' }],
        },
        {
          kind: 'expression',
          expression: 'count++',
        },
        {
          kind: 'return',
          expression: 'count',
        },
      ],
    });

    primitive.create(classNode);
    const method = classNode.getMethod('mixedTest')!;
    const body = method.getBodyText();
    expect(body).toContain('let count = 0;');
    expect(body).toContain('count++;');
    expect(body).toContain('return count;');
  });

  it('should fall back to legacy string arrays', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new MethodPrimitive({
      name: 'legacyTest',
      statements: ['const x = 1;', 'return x;'],
    });

    primitive.create(classNode);
    const method = classNode.getMethod('legacyTest')!;
    expect(method.getBodyText()).toContain('const x = 1;');
    expect(method.getBodyText()).toContain('return x;');
  });
});
