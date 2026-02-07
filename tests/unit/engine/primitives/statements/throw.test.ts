/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { ThrowStatementPrimitive } from '@nexical/generator/engine/primitives/statements/throw';

describe('ThrowStatementPrimitive', () => {
  it('should generate a throw statement', () => {
    const primitive = new ThrowStatementPrimitive({
      kind: 'throw',
      expression: 'new Error("fail")',
    });
    expect(primitive.generate()).toBe('throw new Error("fail");');
  });
});
