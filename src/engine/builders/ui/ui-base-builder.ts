import { BaseBuilder } from '../base-builder.js';
import {
  type ModuleConfig,
  type ModelDef,
  type NodeContainer,
  type FileDefinition,
  type PageDefinition,
  type ShellDefinition,
  type RegistryItemDefinition,
  type TableConfig,
  type FormFieldConfig,
  type ResolvedRoute,
  type CustomRoute,
} from '../../types.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { ModelParser } from '../../model-parser.js';
import { toPascalCase } from '../../../utils/string.js';
import { ModuleLocator } from '../../../lib/module-locator.js';

export interface UiConfig {
  backend?: string;
  prefix?: string;
  pages?: PageDefinition[];
  shells?: ShellDefinition[];
  registries?: Record<string, RegistryItemDefinition[]>;
  forms?: Record<string, Record<string, FormFieldConfig>>;
  tables?: Record<string, TableConfig>;
}

export abstract class UiBaseBuilder extends BaseBuilder {
  protected uiConfig: UiConfig = {};

  constructor(
    protected moduleName: string,
    protected config: ModuleConfig,
    protected modulePath: string,
  ) {
    super();
  }

  // Dummy implementation of abstract method from BaseBuilder as UI builders often iterate multiple files
  protected getSchema(node?: NodeContainer): FileDefinition {
    throw new Error(
      'UiBaseBuilder subclasses often manage their own file generation loop. Use build() or override getSchema().',
    );
  }

  protected loadUiConfig() {
    if (!this.modulePath) {
      return;
    }
    const configPath = join(this.modulePath, 'ui.yaml');
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf8');
        this.uiConfig = YAML.parse(content) as UiConfig;
      } catch {
        console.warn(`[UiBaseBuilder] Failed to parse ui.yaml for ${this.moduleName}`);
      }
    } else {
      console.warn(`[UiBaseBuilder] ui.yaml NOT FOUND at ${configPath}`);
    }
  }

  protected resolveModels(): ModelDef[] {
    const targetModule = this.uiConfig.backend || this.moduleName;
    const backendModule = ModuleLocator.resolve(targetModule);
    const modelsPath = join(backendModule.path, 'models.yaml');

    if (!existsSync(modelsPath)) {
      return [];
    }

    try {
      const { models } = ModelParser.parse(modelsPath);
      return models;
    } catch {
      return [];
    }
  }

  protected resolveRoutes(): ResolvedRoute[] {
    const targetModule = this.uiConfig.backend || this.moduleName;
    const backendModule = ModuleLocator.resolve(targetModule);
    const apiPath = join(backendModule.path, 'api.yaml');

    if (!existsSync(apiPath)) {
      return [];
    }

    try {
      const content = readFileSync(apiPath, 'utf8');
      const parsed = YAML.parse(content) as Record<string, unknown>;
      // api.yaml structure: User: [routes]
      // Flatten to list of routes with model info
      const routes: ResolvedRoute[] = [];
      Object.entries(parsed || {}).forEach(([modelName, modelRoutes]) => {
        if (Array.isArray(modelRoutes)) {
          modelRoutes.forEach((route) => {
            routes.push({ ...(route as CustomRoute), modelName });
          });
        }
      });
      return routes;
    } catch {
      return [];
    }
  }

  protected getModuleTypeName(): string {
    const targetModule = this.uiConfig.backend || this.moduleName;
    if (!targetModule) return 'GlobalModuleTypes';
    const cleanName = targetModule.endsWith('-api')
      ? targetModule.replace(/-api$/, '')
      : targetModule;
    return `${toPascalCase(cleanName)}ModuleTypes`;
  }
}
