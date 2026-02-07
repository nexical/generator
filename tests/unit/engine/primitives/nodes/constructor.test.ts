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
});
