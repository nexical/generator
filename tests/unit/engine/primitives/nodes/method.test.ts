/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { createTestProject } from '@nexical/generator-tests/helpers/test-project';
import { MethodPrimitive } from '@nexical/generator/engine/primitives/nodes/method';

describe('MethodPrimitive', () => {
  it('should add a method to a class', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass {}');
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new MethodPrimitive({
      name: 'testMethod',
      returnType: 'string',
      statements: ['return "hello";'],
    });

    primitive.ensure(classNode);

    const method = classNode.getMethod('testMethod');
    expect(method).toBeDefined();
    expect(method?.getReturnType().getText()).toBe('string');
    expect(method?.getBodyText()).toContain('return "hello";');
  });

  it('should update an existing method', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      `
            class TestClass {
                testMethod(): number { return 1; }
            }
        `,
    );
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new MethodPrimitive({
      name: 'testMethod',
      returnType: 'string', // Changed return type
      statements: ['return "updated";'],
      overwriteBody: true,
    });

    primitive.ensure(classNode);

    const method = classNode.getMethod('testMethod');
    expect(method?.getReturnType().getText()).toBe('string');
    expect(method?.getBodyText()).toContain('return "updated";');
  });

  it('should handle async methods', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass {}');
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new MethodPrimitive({
      name: 'asyncMethod',
      isAsync: true,
      returnType: 'Promise<void>',
    });

    primitive.ensure(classNode);

    const method = classNode.getMethod('asyncMethod');
    expect(method?.isAsync()).toBe(true);
  });

  it('should reconcile parameters', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      `
            class TestClass {
                test(oldName: any) {}
            }
        `,
    );
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new MethodPrimitive({
      name: 'test',
      parameters: [
        { name: 'newName', type: 'string' }, // Rename & Type change
        { name: 'added', type: 'number' }, // Add
      ],
    });

    primitive.ensure(classNode);

    const method = classNode.getMethod('test')!;
    expect(method.getParameters()[0].getName()).toBe('newName');
    expect(method.getParameters()[0].getTypeNode()?.getText()).toBe('string');
    expect(method.getParameters()[1].getName()).toBe('added');
    expect(method.getParameters()[1].getTypeNode()?.getText()).toBe('number');
  });

  it('should reconcile body statements (append)', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      `
            class TestClass {
                test() { console.log("initial"); }
            }
        `,
    );
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new MethodPrimitive({
      name: 'test',
      statements: ['console.log("appended");'],
    });

    primitive.ensure(classNode);

    const body = classNode.getMethod('test')!.getBodyText();
    expect(body).toContain('console.log("initial");');
    expect(body).toContain('console.log("appended");');
  });

  it('should validate correctly', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      `
            class TestClass {
                async test(): Promise<void> {}
            }
        `,
    );
    const classNode = sourceFile.getClass('TestClass')!;
    const methodNode = classNode.getMethod('test')!;

    const primitive = new MethodPrimitive({
      name: 'test',
      isAsync: false, // Mismatch
      returnType: 'string', // Mismatch
    });

    const result = primitive.validate(methodNode);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('async modifier mismatch'))).toBe(true);
    expect(result.issues.some((i) => i.includes('return type mismatch'))).toBe(true);
  });
  it('should update static modifier', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      `
            class TestClass {
                static test() {}
            }
        `,
    );
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new MethodPrimitive({
      name: 'test',
      isStatic: false,
    });
    primitive.ensure(classNode);
    expect(classNode.getMethod('test')?.isStatic()).toBe(false);

    const primitive2 = new MethodPrimitive({
      name: 'test',
      isStatic: true,
    });
    primitive2.ensure(classNode);
    expect(classNode.getMethod('test')?.isStatic()).toBe(true);
  });

  it('should handle decorators', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass { method() {} }');
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new MethodPrimitive({
      name: 'method',
      decorators: [{ name: 'Auth' }],
    });
    primitive.ensure(classNode);
    expect(classNode.getMethod('method')?.getDecorator('Auth')).toBeDefined();
  });

  it('should reconcile parameters with matching count but content difference', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      `
            class TestClass {
                test(a: string, b: number) {}
            }
        `,
    );
    const classNode = sourceFile.getClass('TestClass')!;

    // Test name change
    const primitive = new MethodPrimitive({
      name: 'test',
      parameters: [
        { name: 'a', type: 'string' },
        { name: 'b', type: 'string' }, // Type change
      ],
    });
    primitive.ensure(classNode);

    const method = classNode.getMethod('test')!;
    expect(method.getParameters()[1].getTypeNode()?.getText()).toBe('string');
  });

  it('should validate missing decorators and docs', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      `
            class TestClass {
                test() {}
            }
        `,
    );
    const classNode = sourceFile.getClass('TestClass')!;
    const methodNode = classNode.getMethod('test')!;

    const primitive = new MethodPrimitive({
      name: 'test',
      decorators: [{ name: 'Auth' }],
      docs: ['Required'],
    });

    const result = primitive.validate(methodNode);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("Decorator '@Auth' is missing"))).toBe(true);
    expect(result.issues.some((i) => i.includes('JSDoc is missing'))).toBe(true);
  });

  it('should verify JSDoc insertion text assertions', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass { method() {} }');
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new MethodPrimitive({
      name: 'method',
      docs: ['Description'],
    });
    primitive.ensure(classNode);

    const methodText = classNode.getMethod('method')?.getFullText();
    expect(methodText).toContain('/**');
    expect(methodText).toContain('* Description');
  });

  it('should handle JSDocs', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass { method() {} }');
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new MethodPrimitive({
      name: 'method',
      docs: ['Description'],
    });
    primitive.ensure(classNode);

    // Workaround: ts-morph getJsDocs() seems flaky in in-memory test env for existing methods
    // but getFullText() confirms the JSDoc is present.
    const methodText = classNode.getMethod('method')?.getFullText();
    expect(methodText).toContain('/**');
    expect(methodText).toContain('* Description');
    expect(methodText).toContain('*/');
  });

  it('should validate parameter mismatch detailed', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      `
            class TestClass {
                test(a: string) {}
            }
        `,
    );
    const classNode = sourceFile.getClass('TestClass')!;
    const methodNode = classNode.getMethod('test')!;

    const primitive = new MethodPrimitive({
      name: 'test',
      parameters: [{ name: 'b', type: 'number' }],
    });

    const result = primitive.validate(methodNode);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('name mismatch'))).toBe(true);
    expect(result.issues.some((i) => i.includes('type mismatch'))).toBe(true);
  });

  it('should validate correctly with matching modifiers', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      `
            class TestClass {
                static async test() {}
            }
        `,
    );
    const classNode = sourceFile.getClass('TestClass')!;
    const methodNode = classNode.getMethod('test')!;

    const primitive = new MethodPrimitive({
      name: 'test',
      isStatic: true,
      isAsync: true,
    });

    const result = primitive.validate(methodNode);
    expect(result.valid).toBe(true);
  });
});
