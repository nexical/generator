import { Node } from 'ts-morph';

export interface ValidationResult {
  valid: boolean;
  issues: string[]; // e.g., "Method 'list' is missing async modifier"
}

export interface Primitive<TNode extends Node> {
  // 1. Generation: Write the code if it doesn't exist
  apply(target: Node): TNode;

  // 2. Validation: Check if the existing code matches the intent
  validate(node: TNode): ValidationResult;

  // 3. Ensuring existence and state (Reconciliation)
  ensure(parent: Node): TNode;
}
