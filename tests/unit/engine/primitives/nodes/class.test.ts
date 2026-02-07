/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { createTestProject } from '@nexical/generator-tests/helpers/test-project';
import { ClassPrimitive } from '@nexical/generator/engine/primitives/nodes/class';

describe('ClassPrimitive', () => {
  it('should create a new class if it does not exist', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', '');

    const primitive = new ClassPrimitive({
      name: 'TestClass',
      isExported: true,
    });

    primitive.ensure(sourceFile);

    const classDeclaration = sourceFile.getClass('TestClass');
    expect(classDeclaration).toBeDefined();
    expect(classDeclaration?.isExported()).toBe(true);
  });

  it('should update an existing class', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass {}');

    const primitive = new ClassPrimitive({
      name: 'TestClass',
      isExported: true,
      extends: 'BaseClass',
    });

    primitive.ensure(sourceFile);

    const classDeclaration = sourceFile.getClass('TestClass');
    expect(classDeclaration).toBeDefined();
    expect(classDeclaration?.isExported()).toBe(true);
    expect(classDeclaration?.getExtends()?.getText()).toBe('BaseClass');
  });

  it('should implement interfaces', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', '');

    const primitive = new ClassPrimitive({
      name: 'TestClass',
      implements: ['InterfaceA', 'InterfaceB'],
    });

    primitive.ensure(sourceFile);

    const classDeclaration = sourceFile.getClass('TestClass');
    const implementsClauses = classDeclaration?.getImplements().map((i) => i.getText());
    expect(implementsClauses).toContain('InterfaceA');
    expect(implementsClauses).toContain('InterfaceB');
  });
  it('should handle decorators', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', '');

    const primitive = new ClassPrimitive({
      name: 'TestClass',
      decorators: [{ name: 'Controller', arguments: ['"/test"'] }],
    });

    primitive.ensure(sourceFile);

    const classDeclaration = sourceFile.getClass('TestClass');
    expect(classDeclaration?.getDecorator('Controller')).toBeDefined();
  });

  it('should handle JSDocs', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', '');

    const primitive = new ClassPrimitive({
      name: 'TestClass',
      docs: ['My API class'],
    });

    primitive.ensure(sourceFile);

    const classDeclaration = sourceFile.getClass('TestClass');
    expect(classDeclaration?.getJsDocs()[0].getDescription().trim()).toBe('My API class');
  });

  it('should validate correctly', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass {}');
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new ClassPrimitive({
      name: 'TestClass',
      decorators: [{ name: 'Injectable', arguments: [] }],
      docs: ['Required'],
      isExported: true,
      extends: 'Base',
    });

    const result = primitive.validate(classNode);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("Decorator '@Injectable' is missing"))).toBe(true);
    expect(result.issues.some((i) => i.includes('JSDoc is missing'))).toBe(true);
    expect(result.issues.some((i) => i.includes('exported status mismatch'))).toBe(true);
    expect(result.issues.some((i) => i.includes('extends mismatch'))).toBe(true);
  });

  it('should update export status', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass {}');
    const primitive = new ClassPrimitive({
      name: 'TestClass',
      isExported: true,
    });

    primitive.ensure(sourceFile);
    expect(sourceFile.getClass('TestClass')?.isExported()).toBe(true);
  });

  it('should update extends clause', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      'class TestClass extends OldBase {}',
    );
    const primitive = new ClassPrimitive({
      name: 'TestClass',
      extends: 'NewBase',
    });

    primitive.ensure(sourceFile);
    expect(sourceFile.getClass('TestClass')?.getExtends()?.getText()).toBe('NewBase');
  });

  it('should update abstract status', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass {}');
    const primitive = new ClassPrimitive({
      name: 'TestClass',
      isAbstract: true,
    });

    primitive.ensure(sourceFile);
    expect(sourceFile.getClass('TestClass')?.isAbstract()).toBe(true);

    const primitive2 = new ClassPrimitive({
      name: 'TestClass',
      isAbstract: false,
    });
    primitive2.ensure(sourceFile);
    expect(sourceFile.getClass('TestClass')?.isAbstract()).toBe(false);
  });

  it('should update implements clauses (additive)', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass implements A {}');
    const primitive = new ClassPrimitive({
      name: 'TestClass',
      implements: ['B', 'A'],
    });

    primitive.ensure(sourceFile);
    const impls = sourceFile
      .getClass('TestClass')
      ?.getImplements()
      .map((i) => i.getText());
    expect(impls).toContain('A');
    expect(impls).toContain('B');
  });
});
