---
name: implement-ast-primitive
description: "This skill defines the standard for creating and managing AST (Abstract Syntax Tree) nodes within the generator package. It enforces the 'AST Primitive Pattern' to ensure consistent, idempotent, and v..."
---

# Skill: Implement AST Primitive

This skill defines the standard for creating and managing AST (Abstract Syntax Tree) nodes within the generator package. It enforces the "AST Primitive Pattern" to ensure consistent, idempotent, and verifiable code generation.

## 1. Core Principles

### The AST Primitive Pattern

All AST manipulation logic must be encapsulated in a specific "Primitive" class that extends `BasePrimitive`.

- **Single Responsibility**: Each Primitive manages one specific type of AST node (e.g., `ClassPrimitive`, `InterfacePrimitive`).
- **Composition**: Complex nodes (like a Class with Decorators) delegate child node management to their respective Primitives. Do not inline child logic.

### Configuration-Driven Reconciliation

Primitives are **idempotent**. They accept a `Config` object and ensure the AST node reflects that configuration.

- **Find**: Locate the existing node.
- **Create**: If missing, build it from the config.
- **Update**: If present, compare the current state with the config and apply changes _only_ if they differ.

### Explicit Validation

Primitives must implement a `validate` method that returns a `ValidationResult`.

- **Non-Blocking**: Do not throw errors for validation failures. Return a list of issues.
- **Comprehensive**: Check for all required properties and constraints.

### ESM Relative Imports

**Strict Rule**: All internal imports within the generator package must use the `.js` extension.

- **Correct**: `import { BasePrimitive } from '../core/base-primitive.js';`
- **Incorrect**: `import { BasePrimitive } from '../core/base-primitive';`

## 2. Implementation Structure

A Primitive implementation consists of:

1.  **The Primitive Class**: Extends `BasePrimitive<TNode, TConfig>`.
2.  **The Configuration Interface**: Defines the shape of `TConfig`.
3.  **The Template**: (Optional) A template file if the node is complex to build programmatically.

## 3. Usage

```typescript
// Example Usage
import { ClassPrimitive } from './nodes/class-primitive.js';

const primitive = new ClassPrimitive(sourceFile);
const config = {
  name: 'MyService',
  isExported: true,
  decorators: [{ name: 'Injectable' }],
};

// 1. Validate configuration against current state or constraints
const validation = primitive.validate(config);
if (!validation.valid) {
  console.error(validation.issues);
  return;
}

// 2. Ensure the node exists and matches config
primitive.ensure(config);
```

## 4. Method Signatures

Every Primitive must implement:

- `find(config: TConfig): TNode | undefined`
- `create(config: TConfig): TNode`
- `update(node: TNode, config: TConfig): void`
- `validate(config: TConfig): ValidationResult`
