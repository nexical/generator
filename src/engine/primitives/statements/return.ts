import { type ReturnStatementConfig } from '../../types.js';
import { StatementPrimitive } from './statement-primitive.js';
import { JsxElementPrimitive } from '../jsx/element.js';

export class ReturnStatementPrimitive extends StatementPrimitive<ReturnStatementConfig> {
  generate(): string {
    const { expression } = this.config;
    if (!expression) {
      return 'return;';
    }
    if (typeof expression === 'string') {
      return `return ${expression};`;
    }
    // It is JsxElementConfig
    return `return ${new JsxElementPrimitive(expression).generate()};`;
  }
}
