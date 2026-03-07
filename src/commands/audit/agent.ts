import { BaseCommand } from '@nexical/cli-core';
export default class AuditAgentCommand extends BaseCommand {
  static usage = 'audit agent';
  static description = 'Audit agent definitions in agents.yaml';

  static args = {
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
        description: 'Validate agents.yaml schemas only (no code audit)',
      },
      {
        name: '--verbose',
        description: 'Show detailed output',
      },
    ],
  };

  async run(options: { name?: string; schema?: boolean; verbose?: boolean }) {
    const { auditAgentModule } = await import('../../lib/audit-agent.js');
    await auditAgentModule(this, options.name || '*-api', options);
  }
}
