import { BaseCommand, type CommandDefinition } from '@nexical/cli-core';
import { auditApiModule } from '../../lib/audit-api.js';

export default class AuditApiCommand extends BaseCommand {
  static usage = 'audit api';
  static description = 'Audit web-api module code against models.yaml';

  static args: CommandDefinition = {
    args: [
      {
        name: 'name',
        description: 'The name of the module (or glob pattern) to audit. Defaults to "*-api".',
        required: false,
      },
    ],
    options: [
      {
        name: '--schema',
        description: 'Validate models.yaml and api.yaml schemas only',
      },
    ],
  };

  async run(...args: unknown[]) {
    const options = args[0] as { name: string; schema?: boolean };
    await auditApiModule(this, options.name, { schema: options.schema });
  }
}
