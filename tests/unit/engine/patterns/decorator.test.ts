/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { ClassPrimitive } from '@nexical/generator/engine/primitives/nodes/class';
import { MethodPrimitive } from '@nexical/generator/engine/primitives/nodes/method';

describe('Decorator Support', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
  });

  it('should add a decorator to a class', () => {
    const primitive = new ClassPrimitive({
      name: 'TestClass',
      isExported: true,
      decorators: [{ name: 'Entity', arguments: ['"users"'] }],
    });

    primitive.ensure(sourceFile);

    const classNode = sourceFile.getClass('TestClass');
    expect(classNode).toBeDefined();
    const decorator = classNode?.getDecorator('Entity');
    expect(decorator).toBeDefined();
    expect(decorator?.getArguments().map((a) => a.getText())[0]).toBe('"users"');
  });

  it('should add a decorator to a method', () => {
    const classNode = sourceFile.addClass({ name: 'TestClass' });
    const primitive = new MethodPrimitive({
      name: 'getData',
      decorators: [{ name: 'Get', arguments: ['"/data"'] }],
    });

    primitive.ensure(classNode);

    const method = classNode.getMethod('getData');
    const decorator = method?.getDecorator('Get');
    expect(decorator).toBeDefined();
    expect(decorator?.getArguments()[0].getText()).toBe('"/data"');
  });
});
