/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { JsxElementPrimitive } from '@nexical/generator/engine/primitives/jsx/element';
import { Normalizer } from '@nexical/generator/utils/normalizer';

describe('JsxElementPrimitive', () => {
  it('should generate self-closing element', () => {
    const primitive = new JsxElementPrimitive({
      kind: 'jsx',
      tagName: 'br',
      selfClosing: true,
    });
    expect(primitive.generate()).toBe('<br />');
  });

  it('should generate element with attributes', () => {
    const primitive = new JsxElementPrimitive({
      kind: 'jsx',
      tagName: 'div',
      attributes: [{ name: 'id', value: 'main' }, { name: 'hidden' }],
      selfClosing: true,
    });
    expect(primitive.generate()).toBe('<div id="main" hidden />');
  });

  it('should generate element with children', () => {
    const primitive = new JsxElementPrimitive({
      kind: 'jsx',
      tagName: 'div',
      children: ['Hello', { kind: 'jsx', tagName: 'span', children: ['World'] }],
    });

    const output = primitive.generate();
    expect(Normalizer.normalize(output)).toBe(
      Normalizer.normalize(`
            <div>
                Hello
                <span>
                    World
                </span>
            </div>
        `),
    );
  });

  it('should generate expression children', () => {
    const primitive = new JsxElementPrimitive({
      kind: 'jsx',
      tagName: 'div',
      children: [{ kind: 'expression', expression: 'user.name' }],
    });
    expect(Normalizer.normalize(primitive.generate())).toBe(
      Normalizer.normalize(`
            <div>
                {user.name}
            </div>
        `),
    );
  });
});
