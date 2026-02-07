import { type StatementConfig } from '../../types.js';

/**
 * Base class for statement primitives.
 * Generates string representations of statements based on configuration.
 */
export abstract class StatementPrimitive<TConfig extends StatementConfig = StatementConfig> {
  constructor(protected config: TConfig) {}

  /**
   * Generates a string representation of the statement.
   */
  abstract generate(): string;
}
