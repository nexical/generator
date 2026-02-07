import { type JsxElementConfig } from '../../types.js';
import { JsxAttributePrimitive } from './attribute.js';
import { StatementPrimitive } from '../statements/statement-primitive.js';

export class JsxElementPrimitive extends StatementPrimitive<JsxElementConfig> {
  generate(): string {
    const { tagName, attributes, children, selfClosing } = this.config;

    const propsString =
      attributes?.map((attr) => new JsxAttributePrimitive(attr).generate()).join(' ') || '';
    const spacing = propsString ? ' ' : '';

    if (selfClosing || !children || children.length === 0) {
      return `<${tagName}${spacing}${propsString} />`;
    }

    const childrenString = children
      .map((child) => {
        if (typeof child === 'string') return child;
        if ('kind' in child && child.kind === 'jsx') {
          return new JsxElementPrimitive(child).generate();
        }
        if ('kind' in child && child.kind === 'expression') {
          return `{${child.expression}}`;
        }
        return '';
      })
      .join('\n');

    return `<${tagName}${spacing}${propsString}>\n${childrenString}\n</${tagName}>`;
  }
}
