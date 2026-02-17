import { BaseCommand, type CommandDefinition } from '@nexical/cli-core';
import { auditUiModule } from '../../lib/audit-ui.js';

export default class AuditUiCommand extends BaseCommand {
  static usage = 'audit ui';
  static description = 'Audit UI module configuration and generated files';

  static args: CommandDefinition = {
    args: [
      {
        name: 'name',
        description: 'The name of the module (or glob pattern) to audit. Defaults to "*-ui".',
        required: false,
      },
    ],
    options: [
      {
        name: '--schema',
        description: 'Validate ui.yaml schema only',
      },
    ],
  };

  async run(...args: unknown[]) {
    const options = args[0] as { name: string; schema?: boolean };
    await auditUiModule(this, options.name, { schema: options.schema });
  }
}
