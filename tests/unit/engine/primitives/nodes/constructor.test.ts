/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile, Scope } from 'ts-morph';
import { ConstructorPrimitive } from '@nexical/generator/engine/primitives/nodes/constructor';

describe('ConstructorPrimitive', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', 'class TestClass {}');
  });

  it('should create a constructor', () => {
    const classNode = sourceFile.getClass('TestClass');
    const primitive = new ConstructorPrimitive({
      parameters: [{ name: 'name', type: 'string', scope: Scope.Public }],
      statements: ['console.log(name);'],
    });

    primitive.ensure(classNode!);

    const ctor = classNode?.getConstructors()[0];
    expect(ctor).toBeDefined();
    expect(ctor?.getParameters()[0].getName()).toBe('name');
    expect(ctor?.getParameters()[0].getScope()).toBe(Scope.Public);
    expect(ctor?.getBodyText()).toContain('console.log(name)');
  });
  it('should update constructor body', () => {
    const classNode = sourceFile.getClass('TestClass');
    const primitive = new ConstructorPrimitive({
      statements: ['console.log("updated");'],
    });

    // Add initial constructor
    classNode?.addConstructor({ statements: 'console.log("initial");' });

    primitive.ensure(classNode!);

    const ctor = classNode?.getConstructors()[0];
    expect(ctor?.getBodyText()).toContain('console.log("updated")');
  });

  it('should not update body if statements are not provided', () => {
    const classNode = sourceFile.getClass('TestClass');
    const primitive = new ConstructorPrimitive({}); // no statements
    classNode?.addConstructor({ statements: 'console.log("initial");' });
    primitive.ensure(classNode!);
    const ctor = classNode?.getConstructors()[0];
    expect(ctor?.getBodyText()).toContain('console.log("initial")');
  });

  it('should not update body if statements are identical', () => {
    const classNode = sourceFile.getClass('TestClass');
    const primitive = new ConstructorPrimitive({
      statements: ['console.log("initial");'],
    });
    classNode?.addConstructor({ statements: 'console.log("initial");' });
    primitive.ensure(classNode!);
    const ctor = classNode?.getConstructors()[0];
    expect(ctor?.getBodyText()).toContain('console.log("initial")');
  });

  it('should validate returning true', () => {
    const classNode = sourceFile.getClass('TestClass');
    classNode?.addConstructor({});
    const ctor = classNode?.getConstructors()[0];
    const primitive = new ConstructorPrimitive({});
    const result = primitive.validate(ctor!);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should update body when the constructor has no existing body', () => {
    const classNode = sourceFile.getClass('TestClass');
    const ctor = classNode?.addConstructor({});
    // Remove the body to make getBodyText() return undefined
    ctor?.removeBody();

    const primitive = new ConstructorPrimitive({
      statements: ['console.log("new");'],
    });

    primitive.update(ctor!);
    expect(ctor?.getBodyText()).toContain('console.log("new")');
  });
});
