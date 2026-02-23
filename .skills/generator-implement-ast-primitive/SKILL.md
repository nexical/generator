---
name: generator-implement-ast-primitive
description: 'Expert skill for implementing AST Primitives within the Nexical Generator Engine. Primitives are the foundational building blocks that wrap `ts-morph` AST manipulation logic into a standardized, reconcilable interface.'
---

# generator-implement-ast-primitive

Expert skill for implementing AST Primitives within the Nexical Generator Engine. Primitives are the foundational building blocks that wrap `ts-morph` AST manipulation logic into a standardized, reconcilable interface.

## Core Patterns

### 1. Primitive Class Structure

Every primitive must be a class that extends `BasePrimitive<TNode, TConfig>`. This ensures a consistent constructor and internal configuration management.

- **Location**: Primitives should be placed in `packages/generator/src/engine/primitives/nodes/` (for structural nodes) or appropriate sub-directories.
- **Base Class**: `import { BasePrimitive } from '../core/base-primitive.js';`

### 2. AST Node Lifecycle

Primitives must implement four core lifecycle methods to manage the state of the AST:

- **`find(parent: Node): TNode | undefined`**: Locate the existing node within the parent.
- **`create(parent: Node): TNode`**: Generate a new node if one does not exist.
- **`update(node: TNode): void`**: Sync the existing node's state with the current configuration (Reconciliation).
- **`validate(node: TNode): ValidationResult`**: Compare the actual AST node against the configuration and return an object with validity status and issues.

### 3. Composition of Primitives

Complex AST structures (like a Class with Decorators) should be built by composing primitives. A parent primitive delegates the handling of its children to their specific primitive classes.

**Pattern**: `new ChildPrimitive(config).ensure(parentNode);`

### 4. Validation Pattern (Recursive)

Validation must strictly return a `ValidationResult` object. For composed primitives, the `validate()` method MUST aggregate issues from its child primitives to provide a complete picture of the drift.

```typescript
import { ValidationResult } from '../contracts.js';

override validate(node: TNode): ValidationResult {
  const issues: string[] = [];

  // 1. Local validation
  if (node.getName() !== this.config.name) {
    issues.push(`Name drift: ${node.getName()} != ${this.config.name}`);
  }

  // 2. Recursive validation (Children)
  if (this.config.children) {
    for (const childConfig of this.config.children) {
      const childNode = this.getChildNode(node, childConfig.name);
      if (childNode) {
        const result = new ChildPrimitive(childConfig).validate(childNode);
        issues.push(...result.issues.map(i => `Child ${childConfig.name}: ${i}`));
      } else {
        issues.push(`Missing child: ${childConfig.name}`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
```

### 5. Type-Safe Configuration

Every primitive must have a corresponding configuration interface defined in `packages/generator/src/engine/types.ts`. Avoid using `any` for configuration or node types.

### 6. Structure-Based Creation

To keep the `create()` method clean and declarative, primitives should use a private `toStructure()` method. This method maps the internal `config` to a `ts-morph` `OptionalKind` structure.

**Pattern**:

```typescript
private toStructure(): ClassDeclarationStructure {
  return {
    name: this.config.name,
    isExported: this.config.isExported ?? true
  };
}

create(parent: Node): TNode {
  // Use the structure for clean creation
  return parent.addClass(this.toStructure());
}
```

## Implementation Rules

1. **Zero-Tolerance for `any`**: Always use specific `ts-morph` types (e.g., `ClassDeclaration`, `MethodDeclaration`) and concrete configuration interfaces.
2. **Idempotency**: The `ensure` method (inherited from `BasePrimitive`) must be idempotent. Running it multiple times should result in the same AST state.
3. **Surgical Updates**: In the `update` method, only modify the parts of the node that have drifted from the configuration. Avoid deleting and re-creating nodes if possible.
4. **Explicit Extensions**: Use `.js` extensions for all relative imports to ensure ESM compatibility.
5. **Reconciliation Lifecycle**: The `ensure()` method (provided by `BasePrimitive`) orchestrates the flow: `find()` -> if found then `update()`, else `create()`.

## Directory Structure

- **Core Logic**: `packages/generator/src/engine/primitives/core/base-primitive.ts`
- **Contracts**: `packages/generator/src/engine/primitives/contracts.ts`
- **Types**: `packages/generator/src/engine/types.ts`
- **Node Primitives**: `packages/generator/src/engine/primitives/nodes/`

## Verification Strategy

- **Unit Tests**: Test each primitive in isolation by passing a mock parent node and verifying the resulting AST structure.
- **Drift Detection**: Use the `validate` method to ensure that existing code is correctly identified as "valid" or "invalid" based on configuration changes.
