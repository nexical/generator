import { BaseCommand, type CommandDefinition } from '@nexical/cli-core';
// CRITICAL: Note the .js extension for relative imports
import { performAction } from '../../lib/logic.js';

export default class CommandName extends BaseCommand {
  static usage = 'command:usage';
  static description = 'Command description';

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
    // Delegate logic to library function
    // Pass 'this' if the library function needs to log using CLI helpers
    await performAction(this, options);
  }
}
