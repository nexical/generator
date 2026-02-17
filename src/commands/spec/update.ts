import { BaseCommand } from '@nexical/cli-core';

import path from 'path';
import fs from 'fs-extra';
import { AgentRunner } from '../../utils/agent-runner.js';
import { ModuleLocator } from '../../lib/module-locator.js';

export class SpecUpdateCommand extends BaseCommand {
  static usage = 'spec update';
  static description =
    'Update or reverse-engineer a specification for an existing module or the project';

  static args = {
    args: [
      {
        name: 'name',
        description:
          'The name of the module to update (e.g., "payment-api") or "project" for the root spec',
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

    if (name === 'project' || name === 'root' || name === '.') {
      const specFile = path.join(process.cwd(), 'SPECIFICATION.md');

      if (!(await fs.pathExists(specFile))) {
        this.warn(`SPECIFICATION.md not found in project root. Creating a placeholder.`);
        await fs.writeFile(
          specFile,
          `# Project Specification: ${path.basename(process.cwd())}\n\n(Draft generated from code)`,
        );
      }

      this.success(`\nStarting project specification update (Interactive: ${interactive})...\n`);

      const userInput = interactive
        ? `I want to update the project specification based on the current codebase and my input. Please read the code and interview me.`
        : `I want to update the project specification based on the current codebase. Please draft the specification.`;

      try {
        AgentRunner.run(
          'ProjectSpecWriter',
          'agents/project-spec-writer.md',
          {
            spec_file: specFile,
            user_input: userInput,
          },
          interactive,
        );
      } catch {
        process.exit(1);
      }
      return;
    }

    const modules = await ModuleLocator.expand(name);

    if (modules.length === 0) {
      this.error(`No modules found matching "${name}".`);
      return;
    }

    if (modules.length > 1) {
      this.warn(
        `Found ${modules.length} modules matching "${name}". Updating the first one: ${modules[0].name}`,
      );
    }

    const moduleInfo = modules[0];
    const modulePath = moduleInfo.path;
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
        'agents/module-spec-writer.md',
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
