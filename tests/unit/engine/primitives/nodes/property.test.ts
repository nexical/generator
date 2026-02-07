/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { createTestProject } from '@nexical/generator-tests/helpers/test-project';
import { PropertyPrimitive } from '@nexical/generator/engine/primitives/nodes/property';
import { Scope, PropertyDeclaration } from 'ts-morph';

describe('PropertyPrimitive', () => {
  it('should create a new property (class)', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass {}');
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new PropertyPrimitive({
      name: 'name',
      type: 'string',
      scope: Scope.Public,
      initializer: '""',
    });

    primitive.ensure(classNode);

    const prop = classNode.getProperty('name');
    expect(prop).toBeDefined();
    expect(prop?.getType().getText()).toBe('string');
    expect(prop?.getScope()).toBe(Scope.Public);
    expect(prop?.getInitializer()?.getText()).toBe('""');
  });

  it('should update an existing property', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass { name: any; }');
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new PropertyPrimitive({
      name: 'name',
      type: 'string', // New type
      optional: true,
      initializer: '"default"',
    });

    primitive.ensure(classNode);

    const prop = classNode.getProperty('name');
    expect(prop?.getType().getText()).toBe('string');
    expect(prop?.hasQuestionToken()).toBe(true);
    expect(prop?.getInitializer()?.getText()).toBe('"default"');
  });

  it('should handle decorators and docs', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass { prop: string; }');
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new PropertyPrimitive({
      name: 'prop',
      type: 'string',
      decorators: [{ name: 'Column', arguments: [] }],
      docs: ['Database column'],
    });

    primitive.ensure(classNode);

    const prop = classNode.getProperty('prop');
    expect(prop?.getDecorator('Column')).toBeDefined();
    // Use text assertion for reliability
    expect(prop?.getFullText()).toContain('/**');
    expect(prop?.getFullText()).toContain('Database column');
  });

  it('should update property modifiers', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass { prop: string; }');
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new PropertyPrimitive({
      name: 'prop',
      type: 'string',
      readonly: true,
      isStatic: true,
      scope: Scope.Private,
    });

    primitive.ensure(classNode);

    const prop = classNode.getProperty('prop');
    expect(prop?.isReadonly()).toBe(true);
    expect(prop?.isStatic()).toBe(true);
    expect(prop?.getScope()).toBe(Scope.Private);

    // Revert
    const primitive2 = new PropertyPrimitive({
      name: 'prop',
      type: 'string',
      readonly: false,
      isStatic: false,
      scope: Scope.Public,
    });
    primitive2.ensure(classNode);
    expect(prop?.isReadonly()).toBe(false);
    expect(prop?.isStatic()).toBe(false);
    expect(prop?.getScope()).toBe(Scope.Public);
  });

  it('should validate advanced mismatches', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      'class TestClass { static prop: string = "init"; }',
    );
    const classNode = sourceFile.getClass('TestClass')!;
    const propNode = classNode.getStaticProperty('prop')!; // static

    const primitive = new PropertyPrimitive({
      name: 'prop',
      type: 'string',
      isStatic: false,
      initializer: '"other"',
    });

    const result = primitive.validate(propNode as PropertyDeclaration);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('static modifier mismatch'))).toBe(true);
    expect(result.issues.some((i) => i.includes('initializer mismatch'))).toBe(true);
  });

  it('should validate correctly', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass { prop: number; }');
    const classNode = sourceFile.getClass('TestClass')!;
    const propNode = classNode.getProperty('prop')!;

    const primitive = new PropertyPrimitive({
      name: 'prop',
      type: 'string', // Mismatch
      decorators: [{ name: 'Required', arguments: [] }], // Missing
    });

    const result = primitive.validate(propNode);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('type mismatch'))).toBe(true);
    expect(result.issues.some((i) => i.includes("Decorator '@Required' is missing"))).toBe(true);
  });

  it('should validate missing JSDoc and decorators details', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'class TestClass { prop: string; }');
    const classNode = sourceFile.getClass('TestClass')!;
    const propNode = classNode.getProperty('prop')!;

    const primitive = new PropertyPrimitive({
      name: 'prop',
      type: 'string',
      decorators: [{ name: 'Column' }],
      docs: ['Required'],
    });

    const result = primitive.validate(propNode);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("Decorator '@Column' is missing"))).toBe(true);
    expect(result.issues.some((i) => i.includes('JSDoc is missing'))).toBe(true);
  });
  it('should validate valid property', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      `
            class TestClass { 
                /** Doc */ 
                @Col 
                prop: string = "v"; 
            }
        `,
    );
    const classNode = sourceFile.getClass('TestClass')!;
    const propNode = classNode.getProperty('prop')!;

    const primitive = new PropertyPrimitive({
      name: 'prop',
      type: 'string',
      decorators: [{ name: 'Col' }],
      docs: ['Doc'],
      initializer: '"v"',
    });

    const result = primitive.validate(propNode);
    if (!result.valid) console.error('Validation issues:', result.issues);
    expect(result.valid).toBe(true);
  });
});
