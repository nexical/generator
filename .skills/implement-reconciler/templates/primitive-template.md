# Template: New AST Primitive

This template should be used when creating a new `Primitive` to handle a specific TypeScript node type.

## File Structure: `src/engine/primitives/nodes/{name}-primitive.ts`

```typescript
import { BasePrimitive } from '../core/base-primitive.js';
import type { {Name}Config } from '../../types.js';
import type { {NodeType} } from 'ts-morph';

export class {Name}Primitive extends BasePrimitive<{NodeType}, {Name}Config> {
  /**
   * Find the existing AST node in the parent.
   */
  find(parent: any): {NodeType} | undefined {
    // Logic to locate the node using ts-morph
    // e.g., return parent.get{NodeType}(this.config.name);
  }

  /**
   * Create the node in the parent if it does not exist.
   */
  create(parent: any): {NodeType} {
    // Logic to create the node using ts-morph
    // e.g., return parent.add{NodeType}({ name: this.config.name });
  }

  /**
   * Synchronize the AST node with the provided configuration.
   */
  update(node: {NodeType}): void {
    // Logic to sync properties like name, body, decorators, etc.
  }

  /**
   * Validate the AST node without modifying it.
   * Returns a ValidationResult with structural mismatches.
   */
  validate(node: {NodeType}): ValidationResult {
    const result = new ValidationResult();
    // Logic to check properties and add to result if they differ
    return result;
  }
}
```

## Key Guidelines

1.  **Strict ESM Imports**: Use `.js` extension for all relative imports.
2.  **No Domain Logic**: Primitives should ONLY understand AST manipulation, not business or framework-specific rules.
3.  **Idempotency**: The `update` method must be idempotent—running it twice should not result in AST changes if the configuration hasn't changed.
4.  **Error Handling**: Use the `GeneratorError` class for any structural failures.
