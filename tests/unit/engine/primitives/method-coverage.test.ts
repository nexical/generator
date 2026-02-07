/** @vitest-environment node */
/* eslint-disable */
import { describe, it, expect } from 'vitest';
import { Project, Scope } from 'ts-morph';
import { MethodPrimitive } from '@nexical/generator/engine/primitives/nodes/method';

describe('MethodPrimitive Coverage', () => {
  it('should update parameters when type or name changes', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
            class Test {
                method(a: string, b: number) {}
            }
        `,
    );
    const classDecl = sourceFile.getClassOrThrow('Test');
    const methodDecl = classDecl.getMethodOrThrow('method');

    const p = new MethodPrimitive({
      name: 'method',
      parameters: [
        { name: 'a', type: 'string' },
        { name: 'b', type: 'boolean' }, // Changed type
      ],
    });

    p.update(methodDecl);
    expect(methodDecl.getText()).toContain('method(a: string, b: boolean)');
  });

  it('should update parameters when count changes', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
            class Test { method(a: string) {} }
        `,
    );
    const classDecl = sourceFile.getClassOrThrow('Test');
    const methodDecl = classDecl.getMethodOrThrow('method');

    const p = new MethodPrimitive({
      name: 'method',
      parameters: [
        { name: 'a', type: 'string' },
        { name: 'b', type: 'number' }, // Added param
      ],
    });

    p.update(methodDecl);
    expect(methodDecl.getText()).toContain('method(a: string, b: number)');
  });

  it('should reconcile body checks (append missing statements)', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
             class Test {
                 method() {
                     console.log("old");
                 }
             }
         `,
    );
    const classDecl = sourceFile.getClassOrThrow('Test');
    const methodDecl = classDecl.getMethodOrThrow('method');

    const p = new MethodPrimitive({
      name: 'method',
      statements: ['console.log("new");'],
      overwriteBody: false,
    });

    p.update(methodDecl);

    const body = methodDecl.getBodyText();
    expect(body).toContain('console.log("old")');
    expect(body).toContain('console.log("new")');
  });

  it('should catch validation issues for modifiers and return type', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
             class Test {
                 method(): void {}
             }
         `,
    );
    const classDecl = sourceFile.getClassOrThrow('Test');
    const methodDecl = classDecl.getMethodOrThrow('method');

    const p = new MethodPrimitive({
      name: 'method',
      isAsync: true, // expect async
      returnType: 'Promise<void>', // expect Promise
    });

    const result = p.validate(methodDecl);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('async modifier mismatch'))).toBe(true);
    expect(result.issues.some((i) => i.includes('return type mismatch'))).toBe(true);
  });

  it('should catch validation issues for parameters', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
             class Test {
                 method(a: string) {}
             }
         `,
    );
    const classDecl = sourceFile.getClassOrThrow('Test');
    const methodDecl = classDecl.getMethodOrThrow('method');

    const p = new MethodPrimitive({
      name: 'method',
      parameters: [
        { name: 'a', type: 'number' }, // Mismatch type
      ],
    });

    const result = p.validate(methodDecl);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain("parameter 'a' type mismatch");
  });

  it('should catch validation issues for JSDoc and Decorators', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
             class Test {
                 method() {}
             }
         `,
    );
    const classDecl = sourceFile.getClassOrThrow('Test');
    const methodDecl = classDecl.getMethodOrThrow('method');

    const p = new MethodPrimitive({
      name: 'method',
      docs: ['Description'],
      decorators: [{ name: 'TestDeco' }],
    });

    const result = p.validate(methodDecl);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("Decorator '@TestDeco' is missing"))).toBe(true);
    expect(result.issues.some((i) => i.includes('JSDoc is missing'))).toBe(true);
  });
});
