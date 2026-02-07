/** @vitest-environment node */
/* eslint-disable */
import { describe, it, expect } from 'vitest';
import { Node, Project } from 'ts-morph';
import { BasePrimitive } from '@nexical/generator/engine/primitives/core/base-primitive';
import { ValidationResult } from '@nexical/generator/engine/primitives/contracts';

class TestPrimitive extends BasePrimitive<Node, { name: string }> {
  find(parent: Node): Node | undefined {
    return (parent as any).getVariableDeclaration?.(this.config.name);
  }
  create(parent: Node): Node {
    return (parent as any)
      .addVariableStatement({
        declarations: [{ name: this.config.name }],
      })
      .getDeclarations()[0];
  }
  update(node: Node): void {
    // Mock update
  }
}

describe('BasePrimitive', () => {
  it('should ensure a node exists', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');
    const primitive = new TestPrimitive({ name: 'test' });

    const node = primitive.ensure(sourceFile);
    expect(node).toBeDefined();
    expect(sourceFile.getVariableDeclaration('test')).toBeDefined();
  });

  it('should apply a node (alias for ensure)', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');
    const primitive = new TestPrimitive({ name: 'test' });

    const node = primitive.apply(sourceFile);
    expect(node).toBeDefined();
  });

  it('should return valid true by default for validate', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', 'const x = 1;');
    const node = sourceFile.getVariableDeclarationOrThrow('x');
    const primitive = new TestPrimitive({ name: 'test' });

    const result = primitive.validate(node);
    expect(result).toEqual({ valid: true, issues: [] });
  });
});
