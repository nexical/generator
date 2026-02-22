# Skill: Implement Generator Builder

## Description

This skill defines the standard for implementing **Builders** within the `@nexical/generator` package. A Builder is a specialized class responsible for generating, updating, and maintaining source code files (e.g., API actions, UI components) while preserving existing user logic.

## Mandatory Patterns

### 1. Builder Inheritance

All builders MUST extend `BaseBuilder` and implement the `getSchema` method if required by the base class.

```typescript
import { BaseBuilder } from './base-builder.js';

export class MyFeatureBuilder extends BaseBuilder {
  // Implementation
}
```

### 2. Explicit Import Extensions

You **MUST** use the `.js` extension for all relative imports. The generator runs in an ESM environment where explicit extensions are mandatory.

- **CORRECT**: `import { Utils } from './utils.js';`
- **WRONG**: `import { Utils } from './utils';`

### 3. Code Preservation (AST Analysis)

Builders **MUST NOT** blindly overwrite existing files. You must:

1.  Parse the existing file into an AST (Abstract Syntax Tree).
2.  Check for existing methods or properties (e.g., a custom implementation of `run`).
3.  Preserve the body of existing methods unless a "force overwrite" flag is explicitly set.

```typescript
// Example: Checking for existing method
const existingRunMethod = this.ast.getMethod('run');
if (existingRunMethod) {
  // Preserve user code
  this.addMethod('run', existingRunMethod.getBodyText());
} else {
  // Generate default implementation
}
```

### 4. Template Loading

Complex logic generation should be handled via templates (`.tsf` files), not string concatenation. Use the `TemplateLoader`.

```typescript
import { TemplateLoader } from '../utils/template-loader.js';

const template = await TemplateLoader.load('action/run.tsf', {
  inputType: this.inputType,
  outputType: this.outputType,
});
```

### 5. Dynamic Import Injection

Do not hardcode imports that might not be used. Scan the generated source text or AST for usage of specific symbols and inject imports dynamically.

```typescript
if (sourceText.includes('OrchestrationService')) {
  this.addImport({
    moduleSpecifier: '@/lib/orchestration',
    namedImports: ['OrchestrationService'],
  });
}
```

### 6. Action Method Signature

For API Actions, the `run` method signature is strictly standardized:

```typescript
static async run(input: InputType, context: APIContext): Promise<ServiceResponse<OutputType>>
```

### 7. Type-Only Imports

When importing types, you **MUST** use `isTypeOnly: true` to ensure they are erased during compilation if not used as values.

```typescript
this.addImport({
  moduleSpecifier: 'astro',
  namedImports: ['APIContext'],
  isTypeOnly: true,
});
```

## Implementation Steps

1.  **Initialize**: Extend `BaseBuilder`.
2.  **Load Context**: Read the existing file (if any) and parse its AST.
3.  **Resolve Templates**: Load necessary `.tsf` templates using `TemplateLoader`.
4.  **Merge Logic**: Combine the template logic with any preserved user logic from the AST.
5.  **Inject Dependencies**: analyzing the final code to add necessary imports.
6.  **Finalize**: Format and write the file to disk.
