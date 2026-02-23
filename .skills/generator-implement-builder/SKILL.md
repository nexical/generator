---
name: generator-implement-builder
description: 'Expert guide for creating and extending Builders in the Nexical Generator. Builders define the declarative schema for target files while preserving user logic.'
---

# Skill: Implement Generator Builder

This skill defines the standard for creating **Builders** within the `nexical-generator` package. Builders are responsible for generating structured code files (e.g., Actions, Services, Tests) while preserving existing user logic through declarative reconciliation.

## 1. Core Principles

- **Inheritance**: All builders **MUST** extend the abstract `BaseBuilder` class (or specialized base classes like `UiBaseBuilder`).
- **Declarative Schema**: Standard builders **MUST** implement `getSchema(node)` to define the file structure (imports, class, methods).
- **Reconciliation Delegation**: Builders do not manipulate AST directly. They delegate to the `Reconciler` using the schema defined in `getSchema`.
- **Preservation**: Builders **MUST** use the `node` parameter in `getSchema` to inspect the existing AST and preserve manual changes (e.g., custom imports, method bodies).
- **Templates**: Large default code blocks **MUST** be loaded from `.tsf` (TypeScript Fragment) files.
  - **MANDATORY**: These files **MUST** follow the **Strict Fragment Contract** (JSDoc headers, Phantom Declarations, and `fragment` tagged template exports) as defined in the `manage-templates` skill.
- **Generated Headers**: Files fully managed by the generator **MUST** include a warning header defined in the `FileDefinition`.

## 2. Implementation Standards

> **CRITICAL**: Do NOT manually instantiate Primitives or manipulate the AST imperatively (e.g., `node.addMethod`). Rely on the `Reconciler` processing your `FileDefinition`.

### 2.1 Class Structure

Always use `import type` for interfaces and include the `.js` extension for local imports.

```typescript
import { BaseBuilder } from '../base-builder.js';
import { type FileDefinition, type NodeContainer } from '../../types/index.js';

export class FeatureBuilder extends BaseBuilder {
  // ... implementation
}
```

### 2.2 Schema Generation (`getSchema`)

The `getSchema` method is the heart of a standard builder. It returns a `FileDefinition` object describing the target state.

- **Input**: `node?: NodeContainer` (Existing AST, if any).
- **Output**: `FileDefinition` (The desired structure).

```typescript
protected getSchema(node?: NodeContainer): FileDefinition {
  return {
    header: '// GENERATED CODE - DO NOT MODIFY',
    imports: this.buildImports(node),
    class: {
      name: this.className,
      extends: 'BaseFeature',
      methods: [
        this.buildRunMethod(node),
      ],
    },
  };
}
```

### 2.3 Smart Import Resolution

Analyze the existing `sourceText` to conditionally add imports. Use `import { type ... }` for type-only imports.

```typescript
import { type ImportDefinition } from '../../types/index.js';

private buildImports(node?: NodeContainer): ImportDefinition[] {
  const imports: ImportDefinition[] = [
    { module: '@/lib/core', named: ['CoreService'] },
  ];

  // Only import 'Helper' if used in existing code or needed for defaults
  if (node?.source?.includes('Helper') || !node) {
    imports.push({ module: '@/utils/helper', named: ['Helper'] });
  }

  return imports;
}
```

### 2.4 Template Loading (`TemplateLoader`)

Use `TemplateLoader` to load `.tsf` fragments. Refer to the `manage-templates` skill for the required structural patterns (Phantom Declarations).

```typescript
import { TemplateLoader } from '../../utils/template-loader.js';

// Inside a method builder
const defaultBody = TemplateLoader.load('feature/run.tsf', {
  featureName: this.featureName,
});
```

## 3. Advanced: Custom Build Logic (UI Builders)

For complex use cases where a single builder generates multiple files or requires specialized UI logic (e.g., `FormBuilder`), you should extend `UiBaseBuilder` and override the `build()` method.

### 3.1 getSchema vs. Manual Reconciliation

- **Use `getSchema()`**: For standard 1-to-1 file generation (e.g., one Action file). The `BaseBuilder` handles reading the file and calling the `Reconciler` automatically.
- **Use `Reconciler.reconcile()` manually**: When overriding `build()` to manage multiple files or perform custom project operations.

### 3.2 UI Builder Pattern

When extending `UiBaseBuilder`, you often loop through models to generate multiple components.

```typescript
import { type Project, type SourceFile } from 'ts-morph';
import { Reconciler } from '../../reconciler.js';
import { UiBaseBuilder } from './ui-base-builder.js';
import { type FileDefinition } from '../../types/index.js';

export class CustomUiBuilder extends UiBaseBuilder {
  public override async build(
    project: Project,
    _sourceFile: SourceFile | undefined,
  ): Promise<void> {
    const models = this.resolveModels();

    for (const model of models) {
      const fileName = `src/components/${model.name}Component.tsx`;
      const file = project.createSourceFile(fileName, '', { overwrite: true });

      const definition: FileDefinition = {
        header: this.getHeader(),
        imports: this.getImports(model),
        functions: [this.generateComponent(model)],
      };

      // Manual reconciliation call is required here
      Reconciler.reconcile(file, definition);
    }
  }
}
```

## 4. ESM & Hygiene

- **ESM Extensions**: All relative imports **MUST** include the `.js` extension.
- **Explicit Type Imports**: Use `import { type ... }` for type-only imports.
- **Naming**: Filenames are `kebab-case`. Classes are `PascalCase` and match the filename (e.g., `feature-builder.ts` -> `FeatureBuilder`).
