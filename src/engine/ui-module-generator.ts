import { ModuleGenerator } from './module-generator.js';
import { FormBuilder } from './builders/ui/form-builder.js';
import { TableBuilder } from './builders/ui/table-builder.js';
import { I18nBuilder } from './builders/i18n-builder.js';
import { MiddlewareBuilder } from './builders/middleware-builder.js';
import { type ModuleConfig, type ModelDef } from './types.js';

export class UiModuleGenerator extends ModuleGenerator {
  async run(): Promise<void> {
    const config = {
      type: 'feature',
      order: 100,
    } as unknown as ModuleConfig; // Defaults, as we don't strictly parsing module.config.mjs here yet

    console.info(`[UiModuleGenerator] Running for ${this.moduleName}`);

    // Track initial files to diff later
    const initialFiles = new Set(this.project.getSourceFiles().map((f) => f.getFilePath()));

    // Run Builders
    await new FormBuilder(this.moduleName, config, this.modulePath).build(this.project, undefined);
    await new TableBuilder(this.moduleName, config, this.modulePath).build(this.project, undefined);

    // Run I18n Builder last to capture all registered keys
    await new I18nBuilder(this.moduleName, this.modulePath).build(this.project);

    // Run Middleware Builder (Virtual User Actor for Session)
    const virtualUserModel: ModelDef = {
      name: 'User',
      api: false,
      db: false,
      isExported: false,
      default: false,
      extended: false,
      fields: {},
      actor: {
        strategy: 'login',
        name: 'user',
      },
    };
    const middlewareFile = this.getOrCreateFile('src/middleware.ts');
    new MiddlewareBuilder([virtualUserModel], []).ensure(middlewareFile);

    // Register newly created files
    const finalFiles = this.project.getSourceFiles();
    for (const file of finalFiles) {
      if (!initialFiles.has(file.getFilePath())) {
        this.generatedFiles.add(file.getFilePath());
        console.info(`[UiModuleGenerator] [ADD_SET] ${file.getFilePath()}`);
      }
    }

    await this.saveAll();
  }
}
