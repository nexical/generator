# Example: Adding a New Reconciliation Step

This example demonstrates how to add support for a new AST node type (e.g., `Decorator`) to the `Reconciler` while maintaining the mandatory 14-step sequence.

## Scenario

A new `DecoratorPrimitive` has been created to sync TypeScript decorators at the class level. We need to integrate it into the `Reconciler`.

## 1. Update the Reconciler Sequence

Locate the `reconcile` method in `src/engine/reconciler.ts` and add the new primitive. **Ensure it is placed in the correct relative position.**

```typescript
// src/engine/reconciler.ts
import { ClassPrimitive } from './primitives/nodes/class-primitive.js';
import { DecoratorPrimitive } from './primitives/nodes/decorator-primitive.js'; // MUST use .js

export class Reconciler {
  static reconcile(sourceFile: SourceFile, definition: FileDefinition): void {
    // 1. Sync Imports
    ImportPrimitive.reconcile(sourceFile, definition.imports);

    // 2. Safe Pruning
    this.prune(sourceFile, definition);

    // 3. Sync Classes (and internal nodes like decorators)
    // Decorators are often internal to classes, but for this example
    // let's assume they are top-level or need a specific order pass.

    // [Sequence 3]: Sync Classes
    for (const classConfig of definition.classes ?? []) {
      new ClassPrimitive(classConfig).ensure(sourceFile);
    }

    // [Sequence X]: Sync Decorators (if they were top-level or required a separate pass)
    // IMPORTANT: Check the 14-step sequence in ARCHITECTURE.md to find the correct index.
    // If Decorators are top-level, they might go after Variables [8] or Functions [6].
  }
}
```

## 2. Implement the Primitive (Reference)

```typescript
// src/engine/primitives/nodes/decorator-primitive.ts
import { BasePrimitive } from '../core/base-primitive.js'; // MUST use .js

export class DecoratorPrimitive extends BasePrimitive<Decorator, DecoratorConfig> {
  // Implement find, create, update, and validate
}
```

## 3. Verify ESM Extensions

All imports in the new files and the modified `Reconciler` MUST include the `.js` extension to maintain ESM compatibility.
