import { type ExpressionStatementConfig } from '../../types.js';
import { StatementPrimitive } from './statement-primitive.js';

export class ExpressionStatementPrimitive extends StatementPrimitive<ExpressionStatementConfig> {
  generate(): string {
    return `${this.config.expression};`;
  }
}
