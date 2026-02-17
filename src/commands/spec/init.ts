import { BaseCommand } from '@nexical/cli-core';

import path from 'path';
import fs from 'fs-extra';
import { AgentRunner } from '../../utils/agent-runner.js';
import { ModuleLocator } from '../../lib/module-locator.js';

export class SpecInitCommand extends BaseCommand {
  static usage = 'spec init';
  static description = 'Interactively generate a specification for a new module or the project';

  static args = {
    args: [
      {
        name: 'name',
        description:
          'The name of the module to update (e.g., "payment-api") or "project" for the root spec',
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

    if (name === 'project' || name === 'root' || name === '.') {
      const specFile = path.join(process.cwd(), 'SPECIFICATION.md');

      if (await fs.pathExists(specFile)) {
        this.warn(
          `SPECIFICATION.md already exists in the project root. You might want to use "spec:update" instead.`,
        );
        // proceed anyway
      } else {
        await fs.writeFile(
          specFile,
          `# Project Specification: ${path.basename(process.cwd())}\n\n(Draft)`,
        );
      }

      this.success(`\nStarting interactive project specification session...\n`);

      try {
        AgentRunner.run(
          'ProjectSpecWriter',
          'agents/project-spec-writer.md',
          {
            spec_file: specFile,
            user_input: `I want to create a specification for this project. Please interview me.`,
          },
          true,
        );
      } catch {
        process.exit(1);
      }
      return;
    }

    const moduleInfo = ModuleLocator.resolve(name);
    const modulePath = moduleInfo.path;
    const specFile = path.join(modulePath, 'SPECIFICATION.md');

    if (await fs.pathExists(modulePath)) {
      this.warn(
        `Module "${moduleInfo.name}" already exists. You might want to use "spec:update" instead.`,
      );
      // prompt to continue? For now, we proceed but warn.
    } else {
      this.info(`Creating module directory: ${modulePath}`);
      await fs.ensureDir(modulePath);
    }

    if (!(await fs.pathExists(specFile))) {
      await fs.writeFile(specFile, `# Module Specification: ${moduleInfo.name}\n\n(Draft)`);
    }

    this.success(`\nStarting interactive specification session for "${name}"...\n`);

    try {
      AgentRunner.run(
        'SpecWriter',
        'agents/module-spec-writer.md',
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
