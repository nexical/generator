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

  it('should handle structural matching for various statement types', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
             class Test {
                 method() {
                     let x = 1;
                     if (true) { return; }
                     throw new Error();
                     try { } catch(e) { }
                 }
             }
         `,
    );
    const classDecl = sourceFile.getClassOrThrow('Test');
    const methodDecl = classDecl.getMethodOrThrow('method');

    const p = new MethodPrimitive({
      name: 'method',
      statements: [
        { kind: 'variable', declarations: [{ name: 'x', initializer: '1' }], isDefault: true },
        { kind: 'if', condition: 'true', then: '{ return; }' },
        { kind: 'throw', expression: 'new Error()' },
        { kind: 'expression', expression: 'console.log("new")' },
      ],
    });

    p.update(methodDecl);
    const body = methodDecl.getBodyText();
    expect(body).toContain('console.log("new")');
    // Ensure others are NOT duplicated or replaced if matching
    expect(body.match(/let x = 1/g)).toHaveLength(1);
  });

  it('should handle async toggle and parameter mismatches', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile('test.ts', 'class T { m(a: string) {} }');
    const meth = sf.getClassOrThrow('T').getMethodOrThrow('m');

    const p = new MethodPrimitive({
      name: 'm',
      isAsync: true,
      parameters: [{ name: 'b', type: 'number' }], // Mismatch 'a'
    });

    p.update(meth);
    expect(meth.isAsync()).toBe(true);
    expect(meth.getParameters().length).toBe(1);
    expect(meth.getParameters()[0].getName()).toBe('b');
  });

  it('should handle JSON body reconciliation branches', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile('test.ts', 'class T { m() { return { a: 1 }; } }');
    const meth = sf.getClassOrThrow('T').getMethodOrThrow('m');

    const p = new MethodPrimitive({
      name: 'm',
      statements: [{ kind: 'return', expression: '{ a: 2 }' }],
    });

    p.update(meth);
    expect(meth.getBodyText()).toContain('a: 2');
  });

  it('should handle parameter name mismatch in update', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', 'class T { m(a: string) {} }');
    const methodDecl = sourceFile.getClassOrThrow('T').getMethodOrThrow('m');

    const p = new MethodPrimitive({
      name: 'm',
      parameters: [{ name: 'b', type: 'string' }],
    });

    p.update(methodDecl);
    expect(methodDecl.getParameters()[0].getName()).toBe('b');
  });

  it('should handle validation issues for existing decorator/doc', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
            class T {
                @Deco(1)
                /** old */
                m() {}
            }
        `,
    );
    const methodDecl = sourceFile.getClassOrThrow('T').getMethodOrThrow('m');

    const p = new MethodPrimitive({
      name: 'm',
      decorators: [{ name: 'Deco', arguments: ['2'] }],
      docs: ['new'],
    });

    const result = p.validate(methodDecl);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
