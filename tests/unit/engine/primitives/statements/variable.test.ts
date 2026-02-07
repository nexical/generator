/** @vitest-environment node */
/* eslint-disable */
import { describe, it, expect } from 'vitest';
import { VariableStatementPrimitive } from '@nexical/generator/engine/primitives/statements/variable';
import { Normalizer } from '@nexical/generator/utils/normalizer';

describe('VariableStatementPrimitive', () => {
  it('should generate a simple const declaration', () => {
    const primitive = new VariableStatementPrimitive({
      kind: 'variable',
      declarationKind: 'const',
      declarations: [{ name: 'x', initializer: '10' }],
    });
    expect(primitive.generate()).toBe('const x = 10;');
  });

  it('should generate declaration with type', () => {
    const primitive = new VariableStatementPrimitive({
      kind: 'variable',
      declarationKind: 'let',
      declarations: [{ name: 'name', type: 'string', initializer: '"test"' }],
    });
    expect(primitive.generate()).toBe('let name: string = "test";');
  });

  it('should generate multiple declarations', () => {
    const primitive = new VariableStatementPrimitive({
      kind: 'variable',
      declarationKind: 'var',
      declarations: [
        { name: 'a', initializer: '1' },
        { name: 'b', initializer: '2' },
      ],
    });
    expect(primitive.generate()).toBe('var a = 1, b = 2;');
  });
});
