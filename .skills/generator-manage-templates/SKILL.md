---
name: manage-templates
description: 'This skill defines the standard for creating and maintaining **TypeScript Fragment (.tsf)** files used by the `nexical-generator`. These files contain the raw code templates that are injected into use...'
---

# Skill: Manage Generator Templates (.tsf / .txf)

## Description

This skill defines the standard for creating and maintaining **TypeScript Fragment (.tsf)** and **TypeScript JSX Fragment (.txf)** files used by the `nexical-generator`. These files contain raw code templates that are injected into the codebase via the `TemplateLoader`.

## Patterns

### 1. Template Fragment Format

Templates MUST be defined as tagged template literals using the `fragment` tag and exported as the **default export**.

- **File Extensions**:
  - Use `.tsf` for standard TypeScript logic.
  - Use `.txf` for React/JSX components.
- **Engine Hints**: Use a comment immediately after the `fragment` tag to explicitly hint the parser engine: `/* ts */` or `/* tsx */`.

### 2. Fragment Contract Header

Every template file MUST include a `@fragment-contract` JSDoc block at the top. This block serves as metadata describing the template's inputs.

- **Format**: Use the high-signal path-based format: `@source/path {type} variableName`.
- **Generic Inputs**: Use `@input {type} variableName` if the input is not tied to a specific source example.
- **Example**:
  ```typescript
  /** @fragment-contract
   * @description Create Entity
   * @core/.skills/use-ui-primitives/examples/input-primitive.tsx {string} entityName
   */
  ```

### 3. Phantom Declarations

To provide IDE support and type safety for the template file itself, you MUST declare all variables used within the template using `declare const` before the default export. These declarations are stripped during loading.

### 4. Variable Interpolation

Templates support simple variable replacement using the `${key}` syntax.

- **Rule**: Interpolation is performed via string replacement on the raw template content BEFORE parsing.
- **Restriction**: **No Javascript logic** (e.g., ternaries, function calls) is allowed inside the `${}` interpolation blocks. The `TemplateLoader` only supports direct key-to-value mapping.

### 5. Static Template Loader

All template loading MUST go through the `TemplateLoader` utility to ensure correct path resolution and fragment parsing.

- **Usage**: `TemplateLoader.load('path/relative/to/templates/dir.tsf', { key: 'value' })`

## Examples

### Standard Logic Template (`service-create.tsf`)

```typescript
/** @fragment-contract
 * @description Create a new entity instance.
 * @input {string} modelName
 */
import { fragment } from '@nexical/generator';

// Phantom Declarations
declare const modelName: string;

export default fragment /* ts */ `
export const create = async (data: any) => {
  return db.${modelName}.create({ data });
};
`;
```

### React Component Template (`button.txf`)

```typescript
/** @fragment-contract
 * @description Standard UI Button component.
 * @core/.skills/use-ui-primitives/examples/input-primitive.tsx {string} label
 */
import { fragment } from '@nexical/generator';

// Phantom Declarations
declare const label: string;

export default fragment /* tsx */ `
import { Button } from '@/components/ui/button';

export const ActionButton = () => {
  return <Button>${label}</Button>;
};
`;
```
