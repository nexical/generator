---
name: generator-implement-reconciler
description: "Expert guide for implementing and extending the Reconciler engine within the `@nexical/generator`. This skill focuses on the 'Primitive-Based Reconciliation' pattern, ensuring that TypeScript AST modi..."
---

# Skill: generator-implement-reconciler

Expert guide for implementing and extending the Reconciler engine within the `@nexical/generator`. This skill focuses on the "Primitive-Based Reconciliation" pattern, ensuring that TypeScript AST modifications are deterministic, safe, and synchronized with declarative definitions.

## 🎯 Core Objectives

- Implement stateless, idempotent reconciliation of TypeScript `SourceFile` nodes.
- Orchestrate atomic "Primitive" handlers to align AST state with JSON `FileDefinition` schemas.
- Enforce strict "Safe Pruning" and "Header Hoisting" rules to maintain generated file integrity.
- Adhere to the mandatory 14-step reconciliation sequence.

## 🧩 Mandatory Patterns

### 1. Primitive-Based Reconciliation

The Reconciler must never manipulate the AST directly. It delegates all structural modifications to atomic `Primitive` handlers (found in `src/engine/primitives/`).

- **Rule**: Every structural element (Import, Class, Function, etc.) MUST have a corresponding Primitive class that implements `ensure`, `find`, and `validate`.
- **Example**: `new ClassPrimitive(classConfig).ensure(sourceFile);`

### 2. Static Utility Orchestrator

The `Reconciler` class is a stateless service. It must not be instantiated.

- **Rule**: Stateless orchestration logic should be encapsulated in a class with static methods.
- **Example**: `export class Reconciler { static reconcile(sourceFile, definition) { ... } }`

### 3. Safe Pruning

To prevent data loss, the Reconciler only removes orphaned nodes (nodes present in the file but missing from the definition) if the file is explicitly marked.

- **Rule**: Pruning MUST only be performed on files containing the `// GENERATED CODE` marker.

### 4. ESM Relative Imports

The generator codebase itself must strictly follow ESM standards.

- **Rule**: All relative imports MUST include the `.js` extension, even when importing from `.ts` files.
- **Example**: `import { GeneratorError } from './errors.js';`

### 5. Header Hoisting

Ensures the generation warning remains visible and at the absolute top of the file.

- **Rule**: The `// GENERATED CODE` header MUST be hoisted to line 1 of the file, removing any duplicate occurrences or extra whitespace introduced during AST manipulation.

## 🔄 AST Node Reconciliation Order

The `Reconciler.reconcile` method MUST follow this deterministic sequence of operations:

1.  **Imports**: Sync all external dependencies.
2.  **Pruning**: Remove orphaned nodes (if `// GENERATED CODE` is present).
3.  **Classes**: Sync class definitions and their internal nodes (methods, properties).
4.  **Interfaces**: Sync interface definitions.
5.  **Enums**: Sync enum definitions.
6.  **Functions**: Sync top-level function declarations.
7.  **Types**: Sync type aliases.
8.  **Variables**: Sync variable declarations.
9.  **Components**: Sync React/UI component definitions.
10. **Modules**: Sync module-level declarations.
11. **Roles/Permissions**: Sync security and RBAC definitions.
12. **Exports**: Sync named and default exports.
13. **Raw Statements**: Append or sync arbitrary code blocks.
14. **Header Hoisting**: Final pass to ensure the header is at line 1.

## 🛠️ Implementation Workflow: Adding a New Node Type

When extending the generator to support a new TypeScript node type (e.g., `Decorator`):

1.  **Define Config**: Add the `DecoratorConfig` interface to `src/engine/types.ts`.
2.  **Create Primitive**: Implement `DecoratorPrimitive` in `src/engine/primitives/nodes/decorator-primitive.ts`.
3.  **Update Reconciler**:
    - Add the new primitive to the `Reconciler.reconcile` method.
    - **CRITICAL**: Ensure it is placed in the correct relative position according to the 14-step sequence.
4.  **Add ESM Extension**: Ensure the new file and its imports use the `.js` extension.
