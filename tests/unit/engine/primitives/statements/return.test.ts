/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { ReturnStatementPrimitive } from '@nexical/generator/engine/primitives/statements/return';

describe('ReturnStatementPrimitive', () => {
  it('should generate a return statement with expression', () => {
    const primitive = new ReturnStatementPrimitive({
      kind: 'return',
      expression: '"success"',
    });
    expect(primitive.generate()).toBe('return "success";');
  });

  it('should generate a void return', () => {
    const primitive = new ReturnStatementPrimitive({
      kind: 'return',
    });
    expect(primitive.generate()).toBe('return;');
  });
});
