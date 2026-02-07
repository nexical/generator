/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile, Scope, GetAccessorDeclaration } from 'ts-morph';
import { AccessorPrimitive } from '@nexical/generator/engine/primitives/nodes/accessor';

describe('AccessorPrimitive', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile(
      'test.ts',
      'class TestClass { private _name: string = ""; }',
    );
  });

  it('should create a getter', () => {
    const classNode = sourceFile.getClass('TestClass');
    const primitive = new AccessorPrimitive({
      name: 'name',
      kind: 'get',
      returnType: 'string',
      scope: Scope.Public,
      statements: ['return this._name;'],
    });

    primitive.ensure(classNode!);

    const getter = classNode?.getGetAccessor('name');
    expect(getter).toBeDefined();
    expect(getter?.getReturnType().getText()).toBe('string');
    expect(getter?.getBodyText()).toContain('return this._name;');
  });

  it('should create a setter', () => {
    const classNode = sourceFile.getClass('TestClass');
    const primitive = new AccessorPrimitive({
      name: 'name',
      kind: 'set',
      parameters: [{ name: 'value', type: 'string' }],
      scope: Scope.Public,
      statements: ['this._name = value;'],
    });

    primitive.ensure(classNode!);

    const setter = classNode?.getSetAccessor('name');
    expect(setter).toBeDefined();
    expect(setter?.getParameters()[0].getName()).toBe('value');
    expect(setter?.getBodyText()).toContain('this._name = value;');
  });

  it('should update a setter', () => {
    const classNode = sourceFile.getClass('TestClass');
    classNode?.addSetAccessor({
      name: 'name',
      parameters: [{ name: 'val', type: 'any' }],
      statements: ['console.log(val);'],
    });

    const primitive = new AccessorPrimitive({
      name: 'name',
      kind: 'set',
      parameters: [{ name: 'value', type: 'string' }],
      statements: ['this._name = value;'],
    });

    primitive.ensure(classNode!);

    const setter = classNode?.getSetAccessor('name');
    expect(setter?.getParameters()[0].getTypeNode()?.getText()).toBe('string');
    expect(setter?.getBodyText()).toContain('this._name = value;');
  });

  it('should handle decorators', () => {
    const classNode = sourceFile.getClass('TestClass');
    const primitive = new AccessorPrimitive({
      name: 'name',
      kind: 'get',
      decorators: [{ name: 'Log', arguments: [] }],
    });

    primitive.ensure(classNode!);

    const getter = classNode?.getGetAccessor('name');
    expect(getter?.getDecorator('Log')).toBeDefined();
  });

  it('should handle JSDocs', () => {
    const classNode = sourceFile.getClass('TestClass');
    const primitive = new AccessorPrimitive({
      name: 'name',
      kind: 'get',
      docs: ['My description'],
    });

    primitive.ensure(classNode!);

    const getter = classNode?.getGetAccessor('name');
    // Use text assertion for reliability in test env
    expect(getter?.getFullText()).toContain('/**');
    expect(getter?.getFullText()).toContain('My description');
  });

  it('should update return type and statements', () => {
    const classNode = sourceFile.getClass('TestClass');
    // Setup initial state
    const getter = classNode?.addGetAccessor({
      name: 'prop',
      returnType: 'string',
      statements: 'return "";',
    });

    const primitive = new AccessorPrimitive({
      name: 'prop',
      kind: 'get',
      returnType: 'number',
      statements: ['return 1;'],
    });

    primitive.ensure(classNode!);

    expect(getter?.getReturnType().getText()).toBe('number');
    expect(getter?.getBodyText()?.trim()).toBe('return 1;');
  });

  it('should update setter parameter type', () => {
    const classNode = sourceFile.getClass('TestClass');
    const setter = classNode?.addSetAccessor({
      name: 'prop',
      parameters: [{ name: 'val', type: 'string' }],
      statements: 'this.v = val;',
    });

    const primitive = new AccessorPrimitive({
      name: 'prop',
      kind: 'set',
      parameters: [{ name: 'val', type: 'number' }],
    });

    primitive.ensure(classNode!);
    expect(setter?.getParameters()[0].getTypeNode()?.getText()).toBe('number');
  });

  it('should validate correctly', () => {
    const classNode = sourceFile.getClass('TestClass');
    const getterNode = classNode?.addGetAccessor({ name: 'test' }) as GetAccessorDeclaration;

    const primitive = new AccessorPrimitive({
      name: 'test',
      kind: 'get',
      decorators: [{ name: 'Auth', arguments: [] }],
      docs: ['Required doc'],
    });

    const result = primitive.validate(getterNode);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("Decorator '@Auth' is missing"))).toBe(true);
    expect(result.issues.some((i) => i.includes('JSDoc is missing'))).toBe(true);
  });

  it('should validate kind mismatch', () => {
    const classNode = sourceFile.getClass('TestClass');
    const getterNode = classNode?.addGetAccessor({ name: 'test' }) as GetAccessorDeclaration;

    const primitive = new AccessorPrimitive({
      name: 'test',
      kind: 'set',
    });

    const result = primitive.validate(getterNode);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('kind mismatch. Expected set');
  });

  it('should validate missing validation details', () => {
    const classNode = sourceFile.getClass('TestClass');
    const getterNode = classNode?.addGetAccessor({ name: 'test' }) as GetAccessorDeclaration;

    const primitive = new AccessorPrimitive({
      name: 'test',
      kind: 'get',
      decorators: [{ name: 'Auth' }],
      docs: ['Required'],
    });

    const result = primitive.validate(getterNode);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("Decorator '@Auth' is missing"))).toBe(true);
    expect(result.issues.some((i) => i.includes('JSDoc is missing'))).toBe(true);
  });
  it('should validate valid accessor', () => {
    // Use multiline source to ensure JSDocs are parsed correctly
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile(
      'test-valid.ts',
      `
            class TestClass { 
                /** Doc */ 
                @Dec 
                get valid(): string { return ""; } 
            }
        `,
    );
    const classNode = sourceFile.getClass('TestClass')!;
    const getterNode = classNode.getGetAccessor('valid')!;

    const primitive = new AccessorPrimitive({
      name: 'valid',
      kind: 'get',
      returnType: 'string',
      decorators: [{ name: 'Dec' }],
      docs: ['Doc'],
    });

    const result = primitive.validate(getterNode);
    expect(result.valid).toBe(true);
  });
});
