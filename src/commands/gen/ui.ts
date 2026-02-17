import { BaseCommand, type CommandDefinition } from '@nexical/cli-core';
import { generateUiModule } from '../../lib/generate-ui.js';

export default class GenUiCommand extends BaseCommand {
  static description = 'Generate UI module code from ui.yaml';
  static usage = 'gen ui';

  static args: CommandDefinition = {
    args: [
      {
        name: 'name',
        description: 'The name of the module (or glob pattern) to generate. Defaults to "*-ui".',
        required: false,
      },
    ],
  };

  async run(...args: unknown[]) {
    const options = args[0] as { name: string };
    await generateUiModule(this, options.name);
  }
}
