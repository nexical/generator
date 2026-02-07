/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile, ModuleDeclarationKind } from 'ts-morph';
import { ModulePrimitive } from '@nexical/generator/engine/primitives/nodes/module';

describe('ModulePrimitive', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
  });

  it('should create a namespace', () => {
    const primitive = new ModulePrimitive({
      name: 'MyNamespace',
      isExported: true,
      classes: [{ name: 'InnerClass', isExported: true }],
    });

    primitive.ensure(sourceFile);

    const ns = sourceFile.getModule('MyNamespace');
    expect(ns).toBeDefined();
    expect(ns?.isExported()).toBe(true);
    expect(ns?.getDeclarationKind()).toBe(ModuleDeclarationKind.Namespace);

    const innerClass = ns?.getClass('InnerClass');
    expect(innerClass).toBeDefined();
    expect(innerClass?.isExported()).toBe(true);
  });

  it('should update an existing module (export status)', () => {
    sourceFile.addModule({ name: 'MyNamespace' });
    const primitive = new ModulePrimitive({
      name: 'MyNamespace',
      isExported: true,
    });

    primitive.ensure(sourceFile);
    expect(sourceFile.getModule('MyNamespace')?.isExported()).toBe(true);
  });

  it('should recursively ensure nested content', () => {
    sourceFile.addModule({ name: 'Outer' });

    const primitive = new ModulePrimitive({
      name: 'Outer',
      modules: [
        {
          name: 'Inner',
          variables: [{ name: 'VAL', initializer: '1' }],
        },
      ],
    });

    primitive.ensure(sourceFile);

    const outer = sourceFile.getModule('Outer');
    const inner = outer?.getModule('Inner');
    expect(inner).toBeDefined();
    const val = inner?.getVariableStatement('VAL');
    expect(val).toBeDefined();
  });

  it('should validate correctly', () => {
    sourceFile.addModule({ name: 'MyNamespace', isExported: false });
    const nsNode = sourceFile.getModule('MyNamespace')!;

    const primitive = new ModulePrimitive({
      name: 'MyNamespace',
      isExported: true,
    });

    const result = primitive.validate(nsNode);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('exported status mismatch'))).toBe(true);
  });
});
