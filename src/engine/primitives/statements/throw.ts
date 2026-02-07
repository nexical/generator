import { type ThrowStatementConfig } from '../../types.js';

export class ThrowStatementPrimitive {
  constructor(private config: ThrowStatementConfig) {}

  generate(): string {
    return `throw ${this.config.expression};`;
  }
}
