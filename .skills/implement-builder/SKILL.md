---
name: implement-builder
description: 'This skill defines the standard for creating **Builders** within the `nexical-generator` package. Builders are responsible for generating structured code files (e.g., Actions, Services, Tests) while p...'
---

# Skill: Implement Generator Builder

This skill defines the standard for creating **Builders** within the `nexical-generator` package. Builders are responsible for generating structured code files (e.g., Actions, Services, Tests) while preserving existing user logic.

## 1. Core Principles

- **Inheritance**: All builders **MUST** extend the abstract `BaseBuilder` class.
- **Declarative Schema**: Builders **MUST** implement `getSchema(node)` to define the file structure (imports, class, methods).
- **Preservation**: Builders **MUST** use the `node` parameter in `getSchema` to inspect the existing AST and preserve manual changes (e.g., custom imports, method bodies).
- **Templates**: Large default code blocks **MUST** be loaded from `.tsf` (TypeScript Fragment) templates using `TemplateLoader`, not hardcoded in the builder.
- **Generated Headers**: Files fully managed by the generator **MUST** include a warning header defined in the `FileDefinition`.

## 2. Implementation Standards

> **CRITICAL**: Do NOT manually instantiate Primitives or manipulate the AST imperatively (e.g., `node.addMethod`). Rely solely on the `Reconciler` processing your `FileDefinition`.

### 2.1 Class Structure

```typescript
import { BaseBuilder } from '../base-builder.js';
import { FileDefinition, NodeContainer } from '../../types/index.js';

export class FeatureBuilder extends BaseBuilder {
  // ... implementation
}
```

### 2.2 Schema Generation (`getSchema`)

The `getSchema` method is the heart of the builder. It returns a `FileDefinition` object that describes the target file.

- **Input**: `node?: NodeContainer` (The existing parsed AST of the file, if it exists).
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
        // ... other methods
      ],
    },
  };
}
```

### 2.3 Smart Import Resolution

Builders must conditionally add imports based on whether the generated code (or existing user code) requires them.

- **Check `sourceText`**: If preserving user code, check if it uses a specific symbol before importing it.
- **Avoid Unused Imports**: Do not add imports that are not used in the generated output.

```typescript
private buildImports(node?: NodeContainer): ImportDefinition[] {
  const imports: ImportDefinition[] = [
    { module: '@/lib/core', named: ['CoreService'] },
  ];

  // Smart Resolution: Only import 'Helper' if used in existing code or if we are generating default code that uses it.
  if (node?.source?.includes('Helper') || !node) {
    imports.push({ module: '@/utils/helper', named: ['Helper'] });
  }

  return imports;
}
```

### 2.4 Template Loading (`TemplateLoader`)

Do not hardcode method bodies. Use `TemplateLoader` to load default implementations from `.tsf` files. This keeps the builder logic clean and the templates editable.

```typescript
import { TemplateLoader } from '../../utils/template-loader.js';

// ... inside a method builder
const defaultBody = TemplateLoader.load('feature/run.tsf', {
  featureName: this.featureName,
});
```

### 2.5 ESM Imports

All internal relative imports **MUST** include the `.js` extension to ensure compatibility with the ESM runtime.

- **Correct**: `import { BaseBuilder } from './base-builder.js';`
- **Incorrect**: `import { BaseBuilder } from './base-builder';`

## 3. Usage Definition

When implementing a new builder, ensure it is registered in the `GeneratorFactory` or called explicitly by the relevant command handler.

```typescript
// Example instantiation
const builder = new FeatureBuilder(outputPath, { featureName: 'MyFeature' });
await builder.generate();
```
