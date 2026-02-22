---
name: create-command
description: 'This skill guides the creation of new CLI commands within the `@nexical/generator` package.'
---

# Create Command

This skill guides the creation of new CLI commands within the `@nexical/generator` package.

## Core Mandates

1.  **Inheritance**: All commands MUST extend `BaseCommand` from `@nexical/cli-core`.
2.  **Configuration**: Command metadata (`usage`, `description`, `args`) MUST be defined as `static` properties on the class.
3.  **Strict Typing**: `args` MUST be typed as `CommandDefinition`. The `run` method argument MUST NOT use `any`. Use `Record<string, unknown>` or a specific interface.
4.  **Logic Delegation**: The `run` method MUST be minimal. It should parse options and immediately delegate business logic to a specialized function in `src/lib/`.
5.  **Import Extensions**: You **MUST** use explicit `.js` extensions for all relative imports (e.g., `import { foo } from './foo.js';`). This is critical for the ESM environment.

## File Structure

- Commands go in: `packages/generator/src/commands/`
- Shared Logic goes in: `packages/generator/src/lib/`

## Implementation Pattern

```typescript
import { BaseCommand, type CommandDefinition } from '@nexical/cli-core';
// CRITICAL: Note the .js extension for relative imports
import { performAction } from '../../lib/some-action.js';

export default class ExampleCommand extends BaseCommand {
  static usage = 'example:command';
  static description = 'Example command description';

  static args: CommandDefinition = {
    args: [
      {
        name: 'input',
        description: 'Input argument',
        required: true,
      },
    ],
    options: [
      {
        name: '--flag',
        description: 'An option flag',
        default: false,
      },
    ],
  };

  async run(options: Record<string, unknown>) {
    // Delegate logic
    // Validate options if necessary, then call the library function
    await performAction(this, options);
  }
}
```
