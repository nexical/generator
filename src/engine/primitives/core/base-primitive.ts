import { Node } from 'ts-morph';
import { type Primitive, type ValidationResult } from '../contracts.js';

export abstract class BasePrimitive<TNode extends Node, TConfig> implements Primitive<TNode> {
  constructor(protected config: TConfig) {}

  // The child class implements finding, creating, and updating
  abstract find(parent: Node): TNode | undefined;
  abstract create(parent: Node): TNode;
  abstract update(node: TNode): void;

  // The "Reconciliation" Logic
  ensure(parent: Node): TNode {
    const existing = this.find(parent);

    if (existing) {
      // Option A: Hard Enforce (Overwrite)
      this.update(existing);
      return existing;
    } else {
      // Option B: Create New
      return this.create(parent);
    }
  }

  // Alias for ensure, to match the interface if needed, or strictly use ensure
  apply(target: Node): TNode {
    return this.ensure(target);
  }

  // default validate implementation (can be overridden)
  validate(node: TNode): ValidationResult {
    return { valid: true, issues: [] };
  }
}
