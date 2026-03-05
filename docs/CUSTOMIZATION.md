# Generator Customization Guide

The Nexical Generator allows modules to deeply customize the code generation process. Modules can override existing templates used by the core generator, or they can provide completely custom builders to generate new files or modify existing ones.

This customization is entirely local to the module and requires no changes to the core `@nexical/generator` package.

## 1. Overriding Core Templates

The generator uses a `TemplateLoader` to load `.tsf` and `.txf` files from the central `packages/generator/src/templates/` directory.

You can override any of these templates by recreating the same directory structure within your module's `generator/templates/` folder.

### How it works

When the generator needs a template (e.g., `sdk/get.tsf`), it first checks:
`apps/[backend|frontend]/modules/<your-module>/generator/templates/sdk/get.tsf`

If the file exists, it uses your module's version. If not, it falls back to the core template.

### Example: Customizing the SDK Get Method

1. Determine the path of the core template you want to override (e.g., `packages/generator/src/templates/sdk/get.tsf`).
2. Create the file in your module:
   `apps/backend/modules/my-module/generator/templates/sdk/get.tsf`
3. Add your custom template code:

```typescript
export default fragment /* ts */ `
  /**
   * CUSTOM SDK METHOD
   * Retrieves a ${model.name} by ID with additional metrics.
   */
  async get(id: string): Promise<${model.name}> {
    const response = await this.client.get<${model.name}>(
      \`\${this.basePath}/\${id}?includeMetrics=true\`
    );
    return response.data;
  }
`;
```

## 2. Custom Builders (Dynamic Discovery)

If you need to generate completely new files that the core generator doesn't handle—or if you want to execute custom AST manipulation using the `Reconciler`—you can create Custom Builders.

### How it works

During the `gen api` or `gen ui` process, the generator will automatically scan your module's `generator/builders/` directory.

It will dynamically import every `.ts` file it finds and look for a `default` export that is a class. It will then instantiate that class and call its `run(project, getOrCreateFile)` method.

### Creating a Custom Builder

1. Create a builder file in your module:
   `apps/backend/modules/my-module/generator/builders/my-custom-builder.ts`

2. Export a default class that implements your logic. You can optionally utilize the `Project` from `ts-morph` or the `getOrCreateFile` helper to integrate seamlessly with the generator's file lifecycle.

```typescript
import { Reconciler, type BaseCommand } from '@nexical/generator'; // Import as needed, adjust based on your project setup
import type { Project, SourceFile } from 'ts-morph';

export interface MyModuleContext {
  moduleName: string;
  modulePath: string;
  models?: any[]; // Available if running from gen api
  uiConfig?: any; // Available if running from gen ui
}

export default class MyCustomBuilder {
  private context: MyModuleContext;

  constructor(context: MyModuleContext) {
    this.context = context;
  }

  /**
   * This method is automatically called by the ModuleGenerator.
   *
   * @param project The ts-morph Project instance containing all ASTs.
   * @param getOrCreateFile A helper to safely create or load files within the module,
   *                        ensuring they are tracked and formatted correctly.
   */
  async run(project: Project, getOrCreateFile: (path: string) => SourceFile) {
    console.log(\`[MyCustomBuilder] Running for \${this.context.moduleName}\`);

    // Example: Generate a custom documentation file for each model
    if (this.context.models) {
      for (const model of this.context.models) {
        const filePath = \`docs/\${model.name.toLowerCase()}-api.md\`;

        // Use the helper so the generator tracks and formats the file
        const sourceFile = getOrCreateFile(filePath);

        // You can use ts-morph directly to manipulate AST for TS files,
        // or just write plain text for markdown/json files.
        const content = \`# \${model.name} API\\n\\nThis is a custom generated doc for \${model.name}.\`;

        // Note: For non-TS files, you might need to use standard fs operations
        // if getOrCreateFile is strictly for SourceFiles, or just replace text.
        sourceFile.replaceWithText(content);
      }
    }
  }
}
```

### Context Provided to Builders

The constructor of your custom builder will receive a `context` object containing at least:

- `moduleName`: The name of the module being generated (e.g., `user-api`).
- `modulePath`: The absolute path to the module.

Depending on whether `gen api` or `gen ui` triggered the builder, it may also receive:

- `models`: The parsed `models.yaml` definitions (API).
- `customRoutes`: The parsed `api.yaml` custom routes (API).
- `accessConfig`: The parsed `access.yaml` configuration (API).
- `uiConfig`: The parsed `ui.yaml` configuration (UI).

## Summary

1. **Templates**: Put `.tsf` or `.txf` files in `generator/templates/` to override core outputs.
2. **Builders**: Put `.ts` files exporting a `default class` with a `run()` method in `generator/builders/` to add completely new generation logic.
