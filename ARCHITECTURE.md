# ArcNexus Generator Architecture

The `@nexical/generator` is the core code generation engine for the Nexical Ecosystem. It discards traditional string-based scaffolding (e.g., Handlebars, EJS) in favor of a **Declarative Schema Engine** ("Code-as-Data").

This document details the architectural components, strict design principles, and guidelines for extending the generator.

---

## 🏗️ Core Architectural Principles

1. **Code-as-Data**: TypeScript source files are modeled as structured JSON (`FileDefinition`). We define the _desired state_, not the imperative steps to create it.
2. **Idempotent Reconciliation**: Generating code is the process of computing the diff between the AST (Abstract Syntax Tree via `ts-morph`) and the `FileDefinition`, and applying only the necessary changes. Running generation twice must result in zero changes.
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

- **`find(parent)`**: Locates the specific node safely within a container.
- **`create(parent)`**: Generates a new node if one does not exist.
- **`update(node)`**: Synchronizes the existing node's state with the configuration.
- **`validate(node)`**: Returns structural mismatches (`ValidationResult`) without modifying code (used by the `audit` command).

The **`ensure(parent)`** method orchestrates this lifecycle, acting as the primary reconciliation entry point: it finds the node, and then either updates it or creates it.

_Rule: Primitives must NEVER possess domain logic (e.g., "what should an API endpoint look like"). They strictly translate JSON to AST edits._

### 3. Builders (`src/engine/builders/`)

Builders reside above Primitives. They consume the Ecosystem's domain configuration (like `models.yaml`) and output a declarative `FileDefinition`.

- Example: `ServiceBuilder` reads a `ModelDef` and constructs a JSON schema defining a class (e.g., `UserService`) with standard CRUD methods.
- Builders _never_ touch the AST or `ts-morph` directly. They only construct JSON.

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
