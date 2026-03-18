import { describe, it, expect } from 'vitest';
import { JsxAttributePrimitive } from '@nexical/generator/engine/primitives/jsx/attribute.js';
import { JsxElementPrimitive } from '@nexical/generator/engine/primitives/jsx/element.js';
import { StatementFactory } from '@nexical/generator/engine/primitives/statements/factory.js';
import { type JsxElementConfig, type StatementConfig } from '@nexical/generator/engine/types.js';

describe('Coverage Booster - Primitives', () => {
  describe('JsxAttributePrimitive', () => {
    it('should cover boolean attributes', () => {
      const p = new JsxAttributePrimitive({ name: 'enabled' });
      expect(p.generate()).toBe('enabled');
    });

    it('should cover string attributes', () => {
      const p = new JsxAttributePrimitive({ name: 'label', value: 'Test' });
      expect(p.generate()).toBe('label="Test"');
    });

    it('should cover expression attributes', () => {
      const p = new JsxAttributePrimitive({
        name: 'onClick',
        value: { kind: 'expression', expression: 'handleClick' },
      });
      expect(p.generate()).toBe('onClick={handleClick}');
    });
  });

  describe('JsxElementPrimitive', () => {
    it('should cover self-closing elements', () => {
      const p = new JsxElementPrimitive({ kind: 'jsx', tagName: 'br', selfClosing: true });
      expect(p.generate()).toContain('<br />');
    });

    it('should cover elements with children', () => {
      const p = new JsxElementPrimitive({ kind: 'jsx', tagName: 'div', children: ['Hello'] });
      expect(p.generate()).toContain('<div>');
      expect(p.generate()).toContain('Hello');
    });

    it('should cover elements with attributes', () => {
      const p = new JsxElementPrimitive({
        kind: 'jsx',
        tagName: 'div',
        attributes: [{ name: 'id', value: 'top' }],
      });
      expect(p.generate()).toContain('id="top"');
    });

    it('should cover elements with expression children', () => {
      const config: JsxElementConfig = {
        kind: 'jsx',
        tagName: 'div',
        children: [{ kind: 'expression', expression: 'name' }],
      };
      const p = new JsxElementPrimitive(config);
      expect(p.generate()).toContain('{name}');
    });

    it('should cover elements with jsx children', () => {
      const config: JsxElementConfig = {
        kind: 'jsx',
        tagName: 'div',
        children: [{ kind: 'jsx', tagName: 'span', selfClosing: true }],
      };
      const p = new JsxElementPrimitive(config);
      expect(p.generate()).toContain('<span />');
    });
  });

  describe('StatementFactory', () => {
    it('should cover all factory methods', () => {
      expect(StatementFactory.generate({ kind: 'return', expression: 'val' })).toContain(
        'return val;',
      );
      expect(
        StatementFactory.generate({
          kind: 'throw',
          expression: 'err',
        } as unknown as StatementConfig),
      ).toContain('throw err;');
      expect(
        StatementFactory.generate({
          kind: 'if',
          condition: 'true',
          then: { kind: 'expression', expression: 'do()' },
        }),
      ).toContain('if (true)');
      expect(
        StatementFactory.generate({
          kind: 'variable',
          declarationKind: 'const',
          declarations: [{ name: 'x', initializer: '1' }],
        }),
      ).toContain('const x = 1;');
      expect(StatementFactory.generate({ kind: 'expression', expression: 'do()' })).toContain(
        'do();',
      );
      expect(StatementFactory.generateBlock(['a', 'b'])).toContain('a\nb');
      expect(StatementFactory.generate(null as unknown as StatementConfig)).toBe('');
      expect(StatementFactory.generate('plain string' as unknown as StatementConfig)).toBe(
        'plain string',
      );
      expect(() =>
        StatementFactory.generate({ kind: 'invalid' } as unknown as StatementConfig),
      ).toThrow();
    });
  });
});
