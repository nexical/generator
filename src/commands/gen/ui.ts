import { BaseCommand } from '@nexical/cli-core';

import fs from 'fs-extra';
import path from 'path';
import { UiModuleGenerator } from '../../engine/ui-module-generator.js';

export default class GenUiCommand extends BaseCommand {
  static description = 'Generate UI module code from ui.yaml';

  static args = {
    args: [
      {
        name: 'name',
        description: 'The name of the module to generate.',
        required: true,
      },
    ],
  };

  async run(...args: unknown[]) {
    const options = args[0] as { name: string };
    const { name } = options;

    if (!name) {
      this.error('Module name is required');
    }

    this.info(`\nGenerating UI code for module: ${name}`);
    const moduleDir = path.join(process.cwd(), 'modules', name);

    try {
      if (!fs.existsSync(moduleDir)) {
        this.error(`Module directory '${moduleDir}' does not exist.`);
      }

      // 1. Run Generator
      const generator = new UiModuleGenerator(moduleDir);
      await generator.run();

      this.success(`Successfully generated UI code for "${name}"`);
    } catch (error) {
      this.info(error instanceof Error ? error.message : String(error));
      this.error('Failed to generate UI code');
    }
  }
}
