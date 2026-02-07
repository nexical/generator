import { BaseCommand } from '@nexical/cli-core';

import path from 'path';
import fs from 'fs-extra';
import { AgentRunner } from '../../utils/agent-runner.js';

export class SpecInitCommand extends BaseCommand {
  static description = 'Interactively generate a specification for a new module';

  static args = {
    args: [
      {
        name: 'name',
        description: 'The name of the new module (e.g., "payment-api")',
        required: true,
      },
    ],
  };

  async run(...args: unknown[]) {
    const options = args[0] as { name: string };
    const { name } = options;

    if (!name) {
      this.error('Please provide a module name.');
      return;
    }

    const modulePath = path.join(process.cwd(), 'modules', name);
    const specFile = path.join(modulePath, 'SPECIFICATION.md');

    if (await fs.pathExists(modulePath)) {
      this.warn(`Module "${name}" already exists. You might want to use "spec:update" instead.`);
      // prompt to continue? For now, we proceed but warn.
    } else {
      this.info(`Creating module directory: ${modulePath}`);
      await fs.ensureDir(modulePath);
    }

    if (!(await fs.pathExists(specFile))) {
      await fs.writeFile(specFile, `# Module Specification: ${name}\n\n(Draft)`);
    }

    this.success(`\nStarting interactive specification session for "${name}"...\n`);

    try {
      AgentRunner.run(
        'SpecWriter',
        'agents/spec-writer.md',
        {
          module_root: modulePath,
          spec_file: specFile,
          user_input: `I want to create a new module named "${name}". Please interview me to build the specification.`,
        },
        true,
      );
    } catch {
      process.exit(1);
    }
  }
}

export default SpecInitCommand;
