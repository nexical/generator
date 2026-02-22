import { BaseCommand, type CommandDefinition } from '@nexical/cli-core';
import { z } from 'zod';
import { performAction } from '../../lib/logic.js';

const OptionsSchema = z.object({
  name: z.string().min(1),
  flag: z.boolean().default(false),
});

export default class ValidatedCommand extends BaseCommand {
  static usage = 'validated:command';
  static description = 'Command with validation';

  static args: CommandDefinition = {
    args: [
      {
        name: 'name',
        description: 'Name argument',
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

  async run(rawOptions: Record<string, unknown>) {
    // Validate options
    const result = OptionsSchema.safeParse(rawOptions);

    if (!result.success) {
      this.error(`Invalid options: ${result.error.message}`);
      return;
    }

    const options = result.data;
    await performAction(this, options);
  }
}
