import { Project } from 'ts-morph';
import path from 'node:path';
import { LocaleRegistry } from '../locales/locale-registry.js';

export class I18nBuilder {
  constructor(protected moduleName: string) {}

  async build(project: Project): Promise<void> {
    const locales = LocaleRegistry.getAll();

    const fileName = path.join(
      process.cwd(),
      'modules',
      this.moduleName,
      'src/locales/generated/en.json',
    );

    // Create or overwrite the JSON file
    // We use standard filesystem operations or project.createSourceFile
    // Since it's JSON, creating a source file in ts-morph works fine for emit
    project.createSourceFile(fileName, JSON.stringify(locales, null, 2), { overwrite: true });
  }
}
