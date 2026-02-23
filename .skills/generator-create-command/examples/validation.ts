import { BaseCommand } from '../lib/BaseCommand.js';
import type { CommandDefinition } from '../types/index.js';

export default class ValidationExample extends BaseCommand {
  static usage = 'validate <email>';
  static description = 'Example command showing validation and argument extraction';

  static args: CommandDefinition = {
    arguments: [{ name: 'email', description: 'User email to validate', required: true }],
    options: [
      { flags: '-v, --verbose', description: 'Enable verbose logging' },
      { flags: '-t, --type <type>', description: 'Validation type', defaultValue: 'standard' },
    ],
  };

  async run(...args: unknown[]): Promise<void> {
    // 1. Extract arguments and options
    // Commander passes positional args first, then the options object.
    const email = args[0] as string;
    const options = args[args.length - 1] as Record<string, any>;

    this.info(`Validating email: ${email} with type: ${options.type}`);

    if (options.verbose) {
      this.info('Verbose mode enabled.');
    }

    // 2. Perform validation logic
    if (!email.includes('@')) {
      this.error('Invalid email format: must contain "@" symbol.');
      return;
    }

    // 3. Success output
    this.success('Email validated successfully!');
  }
}
