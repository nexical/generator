import { BaseCommand } from '@nexical/cli-core';

import path from 'path';
import fs from 'fs-extra';
import { AgentRunner } from '../../utils/agent-runner.js';

export class SpecUpdateCommand extends BaseCommand {
  static description = 'Update or reverse-engineer a specification for an existing module';

  static args = {
    args: [
      {
        name: 'name',
        description: 'The name of the module to update (e.g., "payment-api")',
        required: true,
      },
    ],
    options: [
      {
        name: '-i, --interactive',
        description: 'Run in interactive mode',
        default: false,
      },
    ],
  };

  async run(...args: unknown[]) {
    const options = args[0] as { name: string; interactive: boolean };
    const { name, interactive } = options;

    if (!name) {
      this.error('Please provide a module name.');
      return;
    }

    const modulePath = path.join(process.cwd(), 'modules', name);

    if (!(await fs.pathExists(modulePath))) {
      this.error(`Module "${name}" not found at ${modulePath}.`);
      return;
    }

    const specFile = path.join(modulePath, 'SPECIFICATION.md');

    if (!(await fs.pathExists(specFile))) {
      this.warn(`SPECIFICATION.md not found. Creating a placeholder to be filled.`);
      await fs.writeFile(
        specFile,
        `# Module Specification: ${name}\n\n(Draft generated from code)`,
      );
    }

    this.success(
      `\nStarting specification update for "${name}" (Interactive: ${interactive})...\n`,
    );

    const userInput = interactive
      ? `I want to update the specification for "${name}" based on the current code and my input. Please read the code and interview me.`
      : `I want to update the specification for "${name}" based on the current code. Please draft the specification.`;

    try {
      AgentRunner.run(
        'SpecWriter',
        'agents/spec-writer.md',
        {
          module_root: modulePath,
          spec_file: specFile,
          user_input: userInput,
        },
        interactive,
      );
    } catch {
      process.exit(1);
    }
  }
}

export default SpecUpdateCommand;
