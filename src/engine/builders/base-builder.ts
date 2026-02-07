import { Reconciler } from '../reconciler.js';
import { type FileDefinition, type NodeContainer } from '../types.js';
import { type ValidationResult } from '../primitives/contracts.js';

/**
 * Base class for all code builders.
 * Encapsulates the reconciliation logic using the Reconciler.
 */
export abstract class BaseBuilder {
  /**
   * Returns the declarative schema for the file being built.
   */
  protected abstract getSchema(node?: NodeContainer): FileDefinition;

  /**
   * Reconciles the provided SourceFile with the builder's schema.
   */
  ensure(node: NodeContainer): void {
    const schema = this.getSchema(node);
    Reconciler.reconcile(node, schema);
  }

  /**
   * Validates the provided SourceFile against the builder's schema.
   */
  validate(node: NodeContainer): ValidationResult {
    return Reconciler.validate(node, this.getSchema(node));
  }
}
