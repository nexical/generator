# Skill: Manage Generator Templates (.tsf)

## Description

This skill defines the standard for creating and maintaining **TypeScript Fragment (.tsf)** files used by the `nexical-generator`. These files contain the raw code templates that are injected into user projects.

## Patterns

### 1. The .tsf File Extension

All templates MUST use the `.tsf` extension.

### 2. The Fragment Contract (JSDoc)

Every file MUST start with a JSDoc block defining its contract.

- `@fragment-contract`: Marks the file as a valid template.
- `@description`: Brief summary of what the template generates.
- `@param {Type} name`: Defines the variables expected by the template. Context variables are defined as `@path/to/source {Type} variableName`.

### 3. Phantom Declarations

To ensure the template file itself is valid TypeScript (and thus type-checkable), you MUST declare all interpolated variables using `declare const`.

### 4. The Fragment Export

You MUST import `fragment` and export it as the default export.

- Use `/* ts */` (or `/* html */`, etc.) before the backtick to enable IDE syntax highlighting.

## Examples

### Standard Template (`example.tsf`)

```typescript
/** @fragment-contract
 * @description Generates a default API handler.
 * @core/.skills/use-ui-primitives/examples/input-primitive.tsx {string} modelName
 * @core/.skills/use-ui-primitives/examples/input-primitive.tsx {boolean} isAuthenticated
 */
import { fragment } from '@nexical/generator';

// Phantom Declarations
declare const modelName: string;
declare const isAuthenticated: boolean;

export default fragment /* ts */ `
import { ${modelName} } from '@/lib/models';

export const handler = async (req) => {
  ${isAuthenticated ? 'await checkAuth(req);' : '// No auth required'}
  return ${modelName}.findMany();
};
`;
```
