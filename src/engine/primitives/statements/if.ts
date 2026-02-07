import { type IfStatementConfig } from '../../types.js';
import { StatementFactory } from './factory.js';

export class IfStatementPrimitive {
  constructor(private config: IfStatementConfig) {}

  generate(): string {
    const cond = this.config.condition;
    // Recursive generation for blocks
    const thenBlock = StatementFactory.generateStringBlock(this.config.then);
    let result = `if (${cond}) {\n${thenBlock}\n}`;

    if (this.config.else) {
      const elseBlock = StatementFactory.generateStringBlock(this.config.else);
      result += ` else {\n${elseBlock}\n}`;
    }
    return result;
  }
}
