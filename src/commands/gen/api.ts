import { BaseCommand, type CommandDefinition } from '@nexical/cli-core';
import { generateApiModule } from '../../lib/generate-api.js';

export default class GenApiCommand extends BaseCommand {
  static usage = 'gen api';
  static description = 'Generate web-api module code from models.yaml';

  static args: CommandDefinition = {
    args: [
      {
        name: 'name',
        description: 'The name of the module (or glob pattern) to generate. Defaults to "*-api".',
        required: false,
      },
    ],
  };

  async run(...args: unknown[]) {
    const options = args[0] as { name: string };
    // In cli-core, args are often passed as positional arguments in the args object if defined.
    // However, looking at cli-core BaseCommand, args are usually parsed.
    // Let's check how init.ts handled it.
    // InitCommand has 'directory' as required arg.
    // BaseCommand (cli-core) maps args to options object based on keys?
    // Wait, looking at init.ts:
    // async run(options: any) { const directory = options.directory; ... }
    // So yes, args are merged into options.

    await generateApiModule(this, options.name);
  }
}
