# @nexical/generator

The **ArcNexus Generator CLI** (`arc`) is a next-generation code generation tool built on the **Declarative Schema Engine**.

Unlike traditional scaffolding tools that use string templates (Handlebars, EJS), `arc` uses a **"Code-as-Data"** approach. It treats TypeScript source files as structured JSON data, allowing for precise **State Reconciliation** (Auditing and Fixing) without overwriting manual changes.

---

## 🚀 The Declarative Schema Engine

The core philosophy is simple: **Don't write code. Describe it.**

Instead of writing imperative logic (`if file.exists() { append() }`), we define the _desired state_ of a file as a JSON Schema (`FileDefinition`). A generic **Reconciler** engine then applies this state to the AST (Abstract Syntax Tree), handling all the complexity of finding, creating, or updating nodes.

### Benefits

1.  **AI-Native**: LLMs excel at generating structured JSON. This library abstracts the complex `ts-morph` API into simple JSON objects.
2.  **State Reconciliation**: The same schema is used for:
    - **Generation**: Creating new files.
    - **Auditing**: Detecting "Architectural Drift" (e.g., a dev removed a required `static` modifier).
    - **Fixing**: Automatically repairing drift while preserving custom logic.
3.  **Stability**: "Lego Block" primitives ensure syntactically valid code generation every time.

---

## 📂 Project Structure

```
packages/generator/
├── src/
│   ├── commands/           # CLI Commands (new, gen, audit, fix)
│   ├── engine/
│   │   ├── primitives/     # The "Lego Blocks" (Class, Method, Import)
│   │   ├── builders/       # Higher-level Generators (ServiceBuilder)
│   │   ├── reconciler.ts   # The generic Declarative Engine
│   │   └── types.ts        # Schema Definitions (Code-as-Data)
│   └── cli.ts              # Entry Point
```

---

## 🛠️ Usage

### 1. Scaffold

Creates the directory structure and configuration files (`module.def.yaml`, `models.yaml`).

```bash
nexical gen api billing
```

### 2. Generate Code

Reads `models.yaml` and uses the Declarative Engine to generate `Services`, `APIs`, and `SDKs`.

```bash
nexical gen api billing
```

### 3. Audit for Drift

Checks if the actual code matches the architectural schema. Reports issues without changing files.

```bash
nexical audit api billing
```

_Example Output:_

> ✖ [BillingService] Method 'create' is missing.
> ✖ [BillingService] Method 'list' static modifier mismatch. Expected: true, Found: false.

---

## 🤖 For AI Agents & Developers

### The Schema (`FileDefinition`)

To generate code, you simply construct a JSON object matching the `FileDefinition` interface.

```typescript
// src/engine/types.ts

export interface FileDefinition {
  imports?: ImportConfig[];
  classes?: ClassDefinition[];
}

export interface ClassDefinition {
  name: string;
  isExported?: boolean;
  methods?: MethodConfig[];
}

export interface MethodConfig {
  name: string;
  isStatic?: boolean;
  isAsync?: boolean;
  returnType?: string;
  statements?: string | string[];
}
```

### Using the Reconciler

The `Reconciler` class is your main entry point.

```typescript
import { Reconciler } from './engine/reconciler';
import { FileDefinition } from './engine/types';

const schema: FileDefinition = {
  imports: [{ moduleSpecifier: '@/lib/db', namedImports: ['db'] }],
  classes: [
    {
      name: 'UserService',
      isExported: true,
      methods: [
        {
          name: 'list',
          isStatic: true,
          isAsync: true,
          returnType: 'Promise<User[]>',
          statements: 'return db.user.findMany();',
        },
      ],
    },
  ],
};

// Apply the schema to a TypeScript SourceFile
Reconciler.reconcile(sourceFile, schema);

// Or validate it
const result = Reconciler.validate(sourceFile, schema);
if (!result.valid) {
  console.log(result.issues);
}
```

---

## 🧩 Extending functionality

To add new capabilities (e.g., Interfaces, Enums, Zod Schemas), you don't need to change the engine logic.

1.  **Create a Primitive**: Implement `BasePrimitive<Node, Config>` in `src/engine/primitives`.
2.  **Update Schema**: Add the new config type to `FileDefinition` in `src/engine/types.ts`.
3.  **Update Reconciler**: Add one line to `Reconciler.reconcile` to handle the new primitive.
