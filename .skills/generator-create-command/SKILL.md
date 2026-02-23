# generator-create-command

This skill defines the standard for creating new CLI commands within the `@nexical/generator` package. All commands must adhere to the **Abstract Base Class Pattern** to ensure consistency in logging, help formatting, and execution flow.

## 1. Core Principles

- **Inheritance**: Every command MUST extend the local `BaseCommand` class.
- **Static Metadata**: Usage, description, and arguments are defined as static properties.
- **ESM Compliance**: All relative imports MUST include the `.js` extension.
- **Standardized Output**: Use inherited logging methods (`this.info()`, `this.success()`, etc.) instead of `console.log`.

## 2. Command Structure

### The Base Class

Commands are implemented in `packages/generator/src/commands/`. They must import `BaseCommand` from the local `lib` directory.

```typescript
import { BaseCommand } from '../lib/BaseCommand.js';
import type { CommandDefinition } from '../types/index.js';

export default class MyCommand extends BaseCommand {
  static usage = 'my-command';
  static description = 'Perform a specific task';

  static args: CommandDefinition = {
    arguments: [{ name: 'name', description: 'The name of the target' }],
    options: [{ flags: '-f, --force', description: 'Force the operation' }],
    helpMetadata: {
      examples: ['$ nexical my-command my-name --force'],
      troubleshooting: 'If the command fails, ensure you have the correct permissions.',
    },
  };

  async run(...args: unknown[]): Promise<void> {
    const [name, options] = args as [string, Record<string, unknown>];

    this.info(`Starting operation for ${name}...`);

    try {
      // Logic here
      this.success('Operation completed successfully!');
    } catch (error) {
      this.error(`Failed to complete operation: ${error.message}`);
    }
  }
}
```

## 3. Mandatory Patterns

### Static Metadata Declaration

Use the `static args` property to define the command's interface. This includes `arguments`, `options`, and the `helpMetadata` object for extended help content (Examples and Troubleshooting).

### Auto-Configured Action Handler

The `BaseCommand` constructor automatically configures the commander instance. You MUST NOT manually call `.action()` in your subclass. Instead, implement all logic within the `run` method.

### Method Signature

The `run` method receives positional arguments and the options object as a rest parameter array.

```typescript
async run(...args: unknown[]): Promise<void>
```

Typically, positional arguments come first, followed by the options object.

### Inherited Logging

Always use the following methods for terminal output:

- `this.info(message)`: For general information.
- `this.warn(message)`: For non-critical warnings.
- `this.error(message)`: For critical failures (this may exit the process).
- `this.success(message)`: For successful completion messages.

## 4. ESM Requirements

Since the package uses ESM, all relative imports must be explicit.
**Incorrect**: `import { helper } from '../utils/helper';`
**Correct**: `import { helper } from '../utils/helper.js';`
