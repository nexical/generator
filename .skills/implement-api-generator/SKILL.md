# implement-api-generator

Guide for implementing and maintaining the API Generator engine using the Builder Pattern.

## Architecture & Patterns

The API Generator engine is responsible for scaffolding backend modules, services, and API endpoints. It follows a strict **"Code as Data"** philosophy, using AST manipulation rather than simple string interpolation.

### Builder Pattern

Each generated artifact (Service, API Handler, SDK) has a dedicated `*Builder` class that extends `BaseBuilder`.

- **Responsibility**: Builders manage the lifecycle of a file (Create, Read, Update).
- **Preservation**: Builders are non-destructive. They read existing files, parse them into a `NodeContainer`, and only update necessary parts while preserving user-implemented logic.

**Core Builders:**

- `ServiceBuilder`: Generates `src/services/{kebab-name}-service.ts`.
- `ApiBuilder`: Generates `src/pages/api/{kebab-name}/index.ts`.
- `SdkBuilder`: Generates `src/sdk/{kebab-name}-sdk.ts`.

### Model-Driven Architecture

The generation process is strictly driven by declarative configuration files:

- **`models.yaml`**: Defines the data structure and database schema. `ModelParser` reads this to understand entities.
- **`api.yaml`**: Defines custom API operations and "Virtual Models". `ApiModuleGenerator` reads this to scaffold endpoints.

### Virtual Resources (Virtual Models)

"Virtual Models" are entities defined in `api.yaml` that do **not** exist in `models.yaml` (i.e., they have no database table).

- **Use Case**: Purely functional API grouping (e.g., `auth`, `system`, `integrations`) that doesn't map 1:1 to a DB table.
- **Rule**: Entities in `api.yaml` without matching `models.yaml` entries are treated as Virtual Models.
- **Implementation**: The generator skips DB-specific artifacts (Prisma schema updates) but still generates the API Controller, Service shell, and SDK methods.

## Implementation Rules

### Strict Schema Enforcement

All custom routes defined in `api.yaml` MUST define `input` and `output` types to ensure type safety and API contract validity.

```typescript
// Example validation in the generator
if (!route.input) {
  throw new Error(`Route ${route.name} must define an input schema.`);
}
```

### Kebab-Case File Naming

All generated files and directories derived from entity names MUST use kebab-case.

```typescript
import { toKebabCase } from '@/lib/utils';
const fileName = `${toKebabCase(entityName)}-service.ts`;
```

### Reconciliation

For files that might require intelligent updates rather than raw overwrites (like roles and permissions), use a `Reconciler`.

- **`Reconciler.reconcile(file, def)`**: intelligently merges changes.
- **`Builder.ensure(file)`**: standard method for creating/updating artifacts.

## Usage

### Instantiating a Builder

```typescript
import { ServiceBuilder } from './builders/service-builder';

const builder = new ServiceBuilder(modelDefinition);
await builder.ensure(targetFilePath);
```

### Handling API Definitions

```typescript
import { ApiParser } from './parsers/api-parser';

const apiConfig = ApiParser.parse('path/to/api.yaml');
for (const module of apiConfig.modules) {
  // Generate artifacts for each module
}
```
