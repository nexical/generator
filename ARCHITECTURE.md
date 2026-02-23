# ArcNexus Generator Architecture

The `@nexical/generator` is the core code generation engine for the Nexical Ecosystem. It discards traditional string-based scaffolding (e.g., Handlebars, EJS) in favor of a **Declarative Schema Engine** ("Code-as-Data").

This document details the architectural components, strict design principles, and guidelines for extending the generator.

---

## 🏗️ Core Architectural Principles

1. **Code-as-Data**: TypeScript source files are modeled as structured JSON (`FileDefinition`). We define the _desired state_, not the imperative steps to create it.
2. **Configuration-Driven Reconciliation**: Generating code is the process of computing the diff between the AST (Abstract Syntax Tree via `ts-morph`) and the `FileDefinition`, and applying only the necessary changes. Running generation twice must result in zero changes. Updates must be idempotent.
3. **Preservation of Manual Edits**: The generator strictly owns structural nodes it defines. It _does not_ overwrite internal method bodies or arbitrary file additions unless explicitly configured or marked for pruning.
4. **Separation of Concerns**:
   - **Builders**: Understand the Domain (e.g., `models.yaml`, `api.yaml`) and output JSON Schemas (`FileDefinition`).
   - **Primitives**: Understand the AST (TypeScript nodes) and perform precise reconciliation algorithms.
   - **Reconciler**: The agnostic engine that unites Schemas and Primitives.

---

## 🧩 Component Architecture

The `src/engine/` directory represents the heart of the engine, structured into distinct layers of abstraction:

### 1. Types (`src/engine/types.ts`)

The source of truth for the "Code-as-Data" design. It defines the schemas that represent TypeScript structures.

- **`FileDefinition`**: The root schema for a file containing `imports`, `exports`, `classes`, `interfaces`, `enums`, `functions`, `variables`, etc.
- **Node Configs**: Interfaces like `ClassDefinition`, `MethodConfig`, and `PropertyConfig` that dictate exactly what properties a node must have.

### 2. Primitives (`src/engine/primitives/`)

Primitives are the lowest-level "Lego blocks" of the engine acting on individual AST nodes. They implement `BasePrimitive<TNode, TConfig>` (located in `src/engine/primitives/core/base-primitive.ts`) and follow a strict lifecycle:

- **`find(config)`**: Locates the specific node safely within a container based on the configuration.
- **`create(config)`**: Generates a new node if one does not exist.
- **`update(node, config)`**: Synchronizes the existing node's state with the configuration.
- **`validate(config)`**: Returns structural mismatches (`ValidationResult`) without modifying code (used by the `audit` command). **Validation must be non-blocking and comprehensive.**

The **`ensure(config)`** method orchestrates this lifecycle, acting as the primary reconciliation entry point: it finds the node, and then either updates it or creates it.

**Critical Rules for Primitives:**

- **Primitive Composition**: Complex nodes MUST delegate the management of child nodes (e.g., Decorators, JSDocs, Type Parameters) to their respective Primitives. **Do not inline logic for child nodes.**
- **Single Responsibility**: Each Primitive manages exactly one AST node type.
- **No Domain Logic**: Primitives strictly translate JSON to AST edits. They never contain business logic (e.g., "what an API endpoint looks like").

### 3. Builders (`src/engine/builders/`)

Builders reside above Primitives. They consume the Ecosystem's domain configuration (like `models.yaml`) and output a declarative `FileDefinition`.

- **Standard Builders**: Implement `getSchema(node?: NodeContainer): FileDefinition`. The `Reconciler` automatically handles the diffing and updates.
- **UI Builders**: Specialized builders (extending `UiBaseBuilder`) may override the `build()` method to handle multi-file generation or complex UI logic. These builders manually invoke `Reconciler.reconcile(file, definition)`.
- Builders _never_ touch the AST or `ts-morph` directly (except for orchestrating the Reconciler in manual modes). They primarily construct JSON definitions.

### 4. The Reconciler (`src/engine/reconciler.ts`)

The **Static Utility Orchestrator**. The Reconciler is a stateless service that acts as the agnostic engine uniting Schemas and Primitives. It MUST not be instantiated; all orchestration logic is encapsulated in static methods.

- It takes a TypeScript `SourceFile` and a `FileDefinition`.
- **Pruning Phase**: Removes obsolete nodes (classes, interfaces, etc.) from files tagged with `// GENERATED CODE` if they are present in the AST but missing from the `FileDefinition`.
- **Reconciliation Phase**: Iterates through the `FileDefinition` and invokes the `.ensure()` method on corresponding Primitives.
- **Validation Phase**: Drives the `arc audit` feature by evaluating drift without mutating the file.

#### 🔄 AST Node Reconciliation Order

To ensure deterministic code generation, the Reconciler MUST follow this exact sequence:

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

### 5. Module Generators (`src/engine/*-module-generator.ts`)

Orchestrate the macro-level scaffolding of NextJS or Backend modules. They instantiate the required Builders, load target files, and invoke the `Reconciler` across the file system.

---

## 🔄 The Generation Lifecycle

When a developer runs an `arc gen` command:

1. **Parse Domain**: The respective Command logic parses localized `models.yaml` and configurations.
2. **Build Schema**: Builders (`ApiBuilder`, `SdkBuilder`) construct `FileDefinition` JSON objects strictly representing the end state.
3. **Load AST**: The module generator initializes a `ts-morph` Project and loads the target files.
4. **Reconcile**: `Reconciler.reconcile(sourceFile, definition)` is executed.
5. **Flush**: `ts-morph` saves the modified AST to the file system.
6. **Format**: A secondary pass (often via Prettier/ESLint primitives) ensures aesthetic compliance.

---

## 🖥️ CLI Command Architecture

The CLI interface for the generator is built on a standardized class-based architecture to ensure consistency in behavior, logging, and help documentation.

### 1. The Thin Command / Delegation Pattern

All CLI commands MUST extend the abstract `BaseCommand` (located in `src/lib/BaseCommand.ts`). Following the **Thin Command Pattern**, the command class acts as an entry point/adapter that parses CLI arguments and delegates domain logic to dedicated service functions.

- **Static Metadata**: Commands define their interface (usage, description, arguments, options) using the `static usage`, `static description`, and `static args` properties.
- **Auto-Registration**: The `BaseCommand` constructor automatically configures the internal Commander instance and sets up the action handler.
- **Thin Execution**: The `async run(...args: unknown[])` method should contain minimal logic, primarily casting arguments from the CLI and calling a service-level function from the `src/lib/` directory.
- **Standardized Output**: `BaseCommand` provides inherited logging methods (`this.info()`, `this.warn()`, `this.error()`, `this.success()`) which MUST be used for all terminal output to maintain a consistent look and feel.

### 2. CLI-Aware Service Functions

Logic functions in the `src/lib/` directory are designed to be "CLI-aware" by accepting the command instance as their first argument. This allows the service logic to utilize the command's standardized logging and interaction methods without being tightly coupled to the CLI framework.

```typescript
// Example: src/lib/audit-api.ts
export async function auditApiModule(
  command: BaseCommand,
  name: string | undefined,
  options: { schema?: boolean },
) {
  command.info(`Auditing API module: ${name}...`);
  // ... implementation ...
}
```

### 3. Custom Help Formatting

The generator uses a `CustomHelp` formatter to render extended metadata defined in the `helpMetadata` property of the `CommandDefinition`. This allows commands to easily include "Examples" and "Troubleshooting" sections in their `--help` output.

### 3. Command Signature Extraction

The `run` method receives a spread of arguments from Commander. Positional arguments are provided in order, followed by the options object as the final element in the array.

```typescript
async run(...args: unknown[]): Promise<void> {
  const [target, options] = args as [string, Record<string, unknown>];
  // Implementation...
}
```

---

## 🔍 Validation & Auditing

The generator ecosystem provides robust mechanisms for ensuring the integrity of both input configurations and the resulting source code.

### 1. Zod Configuration Validation

External configuration files, such as `models.yaml`, `api.yaml`, and `agents.yaml`, MUST be validated against strict Zod schemas before being processed by Builders. This ensures that domain-specific constraints are caught early and provides clear error messages to the developer.

- **Schemas**: Located in `src/schemas/`.
- **Validation**: Use `.safeParse()` from Zod schemas to evaluate configurations.

### 2. Structural Auditing (Drift Detection)

The `arc audit` suite allows developers to detect "drift" between the desired state (defined in YAML) and the actual source code (AST) without mutating files.

- **Primitive Validation**: Every Primitive implements a `validate(config)` method. Unlike `update()`, this method only compares the configuration against the AST node and returns a `ValidationResult` containing any discrepancies.
- **Audit Reports**: The `audit` commands collect these results and generate reports highlighting discrepancies, which can then be resolved by running `arc gen`.

---

## 🛠️ Extending the Generator

To maintain the engine's integrity, extensions must adhere strictly to the established patterns.

### Adding a new AST capability (A new Primitive)

If you need the generator to understand a new TypeScript feature (e.g., a specific decorator type or JSX fragment):

1. **Define Schema**: Add the configuration interface to `src/engine/types.ts`.
2. **Build Primitive**: Create an implementation extending `BasePrimitive` in `src/engine/primitives/nodes/`. Override `find`, `create`, `update`, and `validate`.
3. **Register**: Add the primitive handling logic into the `Reconciler.reconcile` and `Reconciler.validate` routines.

### Adding complex Domain logic (A new Builder)

When creating generators for new ecosystem features (e.g., a specialized Cron job engine):

1. Add a new `CronBuilder` inside `src/engine/builders/`.
2. Expose a `build()` method returning a `FileDefinition`.
3. Construct the JSON configuration using the types defined in `types.ts`.
4. Register the Builder in the higher-level Module Generator.

---

## ⚠️ Anti-Patterns & Strict Guidelines

- **NO Imperative AST Manipulation**: Do not write `sourceFile.addClass(...)` inside a command or a generic generator component. ALL generation MUST flow through the JSON schema -> Builder -> Reconciler pattern.
- **NO String Templating**: Do not use multiline strings to write entire files or functions. Granular string statements within a `MethodConfig` (`statements: 'return db.user.findMany();'`) are acceptable, but structural hierarchy must use Primitives.
- **Respect User Ownership**: If a file lacks the `// GENERATED CODE` header, the Reconciler will strictly _additive-only_. It will not prune nodes. Honor this behavior.
- **ESM Relative Imports**: To ensure Node.js ESM compatibility, ALL relative imports within the generator codebase (including `src/engine/`) MUST include the `.js` extension, even when importing from `.ts` files.
- **Header Hoisting**: The `// GENERATED CODE` header MUST be hoisted to line 1 of any file it is present in, removing any duplicate occurrences or extra whitespace introduced during AST manipulation.
