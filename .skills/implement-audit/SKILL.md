---
name: implement-audit
description: Expert guide for implementing and extending the Audit suite within the @nexical/generator.
---

# implement-audit

Expert guide for implementing and extending the Audit suite within the `@nexical/generator`. This skill focuses on detecting "drift" between domain configurations (YAML) and the source code (AST) using non-mutative validation patterns.

## 🎯 Objectives

- Implement commands that extend the `arc audit` suite.
- Enforce the **Thin Command / Delegation Pattern** for all CLI entry points.
- Implement **CLI-Aware Service Functions** that handle the core auditing logic.
- Use **Zod Schemas** to validate external configurations before auditing.
- Leverage the **Reconciler** and **Primitives** to perform non-mutative structural validation of the AST.

---

## 🏗️ Architectural Patterns

### 1. Thin Command / Delegation Pattern

CLI commands in `src/commands/audit/` must be thin wrappers. Their sole responsibility is to parse arguments and call a service function.

**Requirement**:

- Extend `BaseCommand`.
- Minimal logic in `run()`.
- Explicit casting of CLI arguments.

### 2. CLI-Aware Service Functions

Domain logic for auditing resides in `src/lib/`. These functions must accept `command: BaseCommand` as their first argument to facilitate standardized logging (`command.info`, `command.error`).

**Requirement**:

- File naming: `src/lib/audit-{feature}.ts`.
- First parameter: `command: BaseCommand`.
- Use `command.info()` for progress and `command.error()` for critical failures.

### 3. Zod Configuration Validation

Before auditing the code, you MUST validate the source YAML configuration.

**Requirement**:

- Define schemas in `src/schemas/`.
- Use `safeParse()` to catch and report configuration errors early.

### 4. Non-Mutative Auditing

Auditing is the process of comparing a `FileDefinition` (produced by a Builder) against a `SourceFile` (AST) using the Reconciler's validation capabilities.

**Requirement**:

- Use `Reconciler.validate(sourceFile, fileDefinition)` to obtain drift reports.
- **NEVER** call `Reconciler.reconcile()` or any mutative methods (like `update()` or `create()` on Primitives) during an audit.

### 5. ESM Compatibility (Strict)

All relative imports in TypeScript source files MUST include the `.js` file extension.

---

## 📂 Directory Structure

- `src/commands/audit/{feature}.ts`: Command definition.
- `src/lib/audit-{feature}.ts`: CLI-aware logic.
- `src/schemas/{feature}-schema.ts`: Zod validation schemas.

---

## 🛠️ Implementation Workflow

### Step 1: Define the Command

Create a new command class in `src/commands/audit/`.

### Step 2: Implement the Service

Create the auditing logic in `src/lib/`. This function should:

1. Load and parse the YAML configuration.
2. Validate the configuration using a Zod schema.
3. Use a Builder to generate the expected `FileDefinition`.
4. Use `Reconciler.validate()` to check for drift.
5. Report findings using `command.info()` or `command.error()`.

### Step 3: Register the Command

Ensure the command is discoverable by the CLI engine (typically via static metadata and file system scanning).

---

## 📝 Examples

### Command Definition (`src/commands/audit/api.ts`)

```typescript
import BaseCommand from '../../lib/BaseCommand.js';
import { auditApiModule } from '../../lib/audit-api.js';

export default class AuditApiCommand extends BaseCommand {
  static usage = 'audit api';
  static description = 'Audit API modules for drift between models.yaml and source code.';

  async run(...args: unknown[]) {
    const options = args[0] as { name?: string };
    await auditApiModule(this, options.name);
  }
}
```

### CLI-Aware Service (`src/lib/audit-api.ts`)

```typescript
import { BaseCommand } from './BaseCommand.js';
import { ApiSchema } from '../schemas/api-schema.js';
import { Reconciler } from '../engine/reconciler.js';
import { ApiBuilder } from '../engine/builders/api-builder.js';

export async function auditApiModule(command: BaseCommand, name: string | undefined) {
  command.info(`Starting audit for API module: ${name ?? 'all'}...`);

  // 1. Validate Config
  const config = loadYaml('api.yaml');
  const result = ApiSchema.safeParse(config);
  if (!result.success) {
    command.error('Invalid api.yaml configuration.');
    return;
  }

  // 2. Build Expected State
  const builder = new ApiBuilder(result.data);
  const expected = builder.getSchema();

  // 3. Validate AST (Non-mutative)
  const sourceFile = project.getSourceFile('api.ts');
  const drift = Reconciler.validate(sourceFile, expected);

  if (drift.length > 0) {
    command.warn(`Found ${drift.length} discrepancies.`);
  } else {
    command.success('No drift detected.');
  }
}
```
