/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { DecoratorPrimitive } from '@nexical/generator/engine/primitives/nodes/decorator.js';

describe('DecoratorPrimitive', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile(
      'test.ts',
      `
            @Existing("old")
            export class TestClass {}
        `,
    );
  });

  it('should update decorator arguments when they drift', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new DecoratorPrimitive({
      name: 'Existing',
      arguments: ['"new"'],
    });

    // Ensure logic basically tries to matching by name (handled by find)
    // Since we are testing primitive directly, we need to mimic ensure flow if not calling ensure
    // But ensure() calls find() then update().
    primitive.ensure(classNode);

    const decorator = classNode.getDecorator('Existing');
    expect(decorator?.getArguments()[0].getText()).toBe('"new"');
  });

  it('should validate decorator arguments', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new DecoratorPrimitive({
      name: 'Existing',
      arguments: ['"expected"'],
    });

    const decorator = classNode.getDecorator('Existing')!;
    const result = primitive.validate(decorator);

    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain("Decorator '@Existing' argument 0 mismatch");
  });

  it('should add new decorator if missing', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new DecoratorPrimitive({
      name: 'NewDeco',
    });

    primitive.ensure(classNode);
    expect(classNode.getDecorator('NewDeco')).toBeDefined();
  });
});
