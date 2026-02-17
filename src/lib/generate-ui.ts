import { BaseCommand } from '@nexical/cli-core';
import { UiModuleGenerator } from '../engine/ui-module-generator.js';
import { ModuleLocator } from '../lib/module-locator.js';
import { glob } from 'glob';
import fs from 'fs-extra';

export async function generateUiModule(command: BaseCommand, name?: string) {
  const pattern = name || '*-ui';
  const modules = await ModuleLocator.expand(pattern);

  // specific check: if no modules found but the name is NOT a glob,
  // implies the user matched nothing but might want to create a NEW module.
  // For UI modules, we currently only support generating for existing modules or explicit paths,
  // but we can look into scaffolding later. For now, if explicit name given and not found, we fail (or just warn).
  // The original gen ui command errored if module didn't exist.
  // Match gen api behavior: try to resolve it if it's a specific name.
  if (modules.length === 0 && !glob.hasMagic(pattern)) {
    modules.push(ModuleLocator.resolve(pattern));
  }

  if (modules.length === 0) {
    command.warn(`No modules found matching pattern "${pattern}"`);
    return;
  }

  command.info(`Found ${modules.length} module(s) to generate.`);

  for (const moduleInfo of modules) {
    await generateForModule(command, moduleInfo);
  }
}

async function generateForModule(command: BaseCommand, moduleInfo: { name: string; path: string }) {
  const { name, path: moduleDir } = moduleInfo;
  command.info(`\nGenerating UI code for module: ${name} (${moduleDir})`);

  try {
    if (!fs.existsSync(moduleDir)) {
      // Unlike API, we might not want to auto-scaffold UI modules from scratch yet
      // unless we have a template. For now, we'll error if it doesn't exist,
      // consistent with previous gen ui command, OR we could just warn and skip.
      // But if user asked for specific name, error is better.
      // If user asked for *, we shouldn't have gotten here (expand only returns existing directories).
      // So this case is only for explicit new module name.
      throw new Error(`Module directory '${moduleDir}' does not exist.`);
    }

    // 1. Run Generator
    const generator = new UiModuleGenerator(moduleDir, { command });
    await generator.run();

    command.success(`Successfully generated UI code for "${name}"`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    command.error(`Failed to generate UI code: ${message}`);
  }
}
