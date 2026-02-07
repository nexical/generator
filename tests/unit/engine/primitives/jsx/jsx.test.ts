/** @vitest-environment node */
/* eslint-disable */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { MethodPrimitive } from '@nexical/generator/engine/primitives/nodes/method.js';
import { JsxElementPrimitive } from '@nexical/generator/engine/primitives/jsx/element.js';
import { JsxElementConfig } from '@nexical/generator/engine/types.js';

describe('JSX Generation', () => {
  it('should generate a self-closing element', () => {
    const config: JsxElementConfig = {
      kind: 'jsx',
      tagName: 'Button',
      selfClosing: true,
    };
    const generated = new JsxElementPrimitive(config).generate();
    expect(generated).toBe('<Button />');
  });

  it('should generate an element with props', () => {
    const config: JsxElementConfig = {
      kind: 'jsx',
      tagName: 'Input',
      selfClosing: true,
      attributes: [{ name: 'type', value: 'text' }, { name: 'required' }],
    };
    const generated = new JsxElementPrimitive(config).generate();
    expect(generated).toBe('<Input type="text" required />');
  });

  it('should generate an element with expression props', () => {
    const config: JsxElementConfig = {
      kind: 'jsx',
      tagName: 'Component',
      selfClosing: true,
      attributes: [{ name: 'onClick', value: { kind: 'expression', expression: 'handleClick' } }],
    };
    const generated = new JsxElementPrimitive(config).generate();
    expect(generated).toBe('<Component onClick={handleClick} />');
  });

  it('should generate nested elements', () => {
    const config: JsxElementConfig = {
      kind: 'jsx',
      tagName: 'div',
      children: [
        {
          kind: 'jsx',
          tagName: 'span',
          children: ['Hello'],
        },
      ],
    };
    const generated = new JsxElementPrimitive(config).generate();
    // Just checking containment for simplicity as whitespace might vary
    expect(generated).toContain('<div>');
    expect(generated).toContain('<span>');
    expect(generated).toContain('Hello');
    expect(generated).toContain('</span>');
    expect(generated).toContain('</div>');
  });

  it('should integrate with MethodPrimitive', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.tsx', 'class TestClass {}');
    const classNode = sourceFile.getClass('TestClass')!;

    const primitive = new MethodPrimitive({
      name: 'render',
      statements: [
        {
          kind: 'return',
          expression: '(<Button variant="primary" />)',
        },
      ],
    });

    primitive.create(classNode);
    const method = classNode.getMethod('render')!;
    expect(method.getBodyText()).toContain('return (<Button variant="primary" />);');
  });
});
