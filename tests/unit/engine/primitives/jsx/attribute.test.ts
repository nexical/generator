/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { JsxAttributePrimitive } from '@nexical/generator/engine/primitives/jsx/attribute';

describe('JsxAttributePrimitive', () => {
  it('should generate boolean attribute', () => {
    const primitive = new JsxAttributePrimitive({ name: 'disabled' });
    expect(primitive.generate()).toBe('disabled');
  });

  it('should generate string attribute', () => {
    const primitive = new JsxAttributePrimitive({ name: 'class', value: 'btn' });
    expect(primitive.generate()).toBe('class="btn"');
  });

  it('should generate expression attribute', () => {
    const primitive = new JsxAttributePrimitive({
      name: 'onClick',
      value: { expression: 'handleClick' },
    });
    expect(primitive.generate()).toBe('onClick={handleClick}');
  });
});
