import { SourceFile, Scope } from 'ts-morph';
import {
  type ModelDef,
  type FileDefinition,
  type ClassDefinition,
  type ConstructorConfig,
  type NodeContainer,
  type ImportConfig,
} from '../types.js';
import { toCamelCase, toPascalCase, toKebabCase } from '../../utils/string.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';

export class SdkIndexBuilder extends BaseBuilder {
  constructor(
    private models: ModelDef[],
    private moduleName: string, // e.g. "user-api"
  ) {
    super();
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    const apiModels = this.models.filter((m) => m.api && !m.extended);
    const defaultModel = apiModels.find((m) => m.default);
    const otherModels = apiModels.filter((m) => m.name !== defaultModel?.name);

    // Only strip -api if it's there, otherwise keep the full name
    const cleanName = this.moduleName.endsWith('-api')
      ? this.moduleName.replace(/-api$/, '')
      : this.moduleName;
    const mainSdkName = `${toPascalCase(cleanName)}Module`;

    const classExtends = defaultModel ? `Base${defaultModel.name}SDK` : 'BaseResource';
    const needsBaseResource = !defaultModel;

    const imports: ImportConfig[] = [
      {
        moduleSpecifier: '@nexical/sdk-core',
        namedImports: needsBaseResource ? ['BaseResource', 'ApiClient'] : ['ApiClient'],
      },
      ...apiModels.map((m) => ({
        moduleSpecifier: `./${toKebabCase(m.name)}-sdk.js`,
        namedImports: [`${m.name}SDK as Base${m.name}SDK`],
      })),
    ];

    const properties = otherModels.map((m) => ({
      name: toCamelCase(m.name),
      type: `Base${m.name}SDK`,
      scope: Scope.Public,
    }));

    const initStatements = otherModels
      .map((m) => `this.${toCamelCase(m.name)} = new Base${m.name}SDK(client);`)
      .join('\n');

    const constructorConfig: ConstructorConfig = {
      parameters: [{ name: 'client', type: 'ApiClient' }],
      statements: [TemplateLoader.load('sdk/index-constructor.tsf', { initStatements })],
    };

    const sdkClass: ClassDefinition = {
      name: mainSdkName,
      isExported: true,
      extends: classExtends,
      properties: properties,
      constructorDef: constructorConfig,
      docs: [`Main SDK for the ${this.moduleName} module.`],
    };

    const exports = [
      ...apiModels.map((m) => ({
        moduleSpecifier: `./${toKebabCase(m.name)}-sdk.js`,
        exportClause: '*',
      })),
      { moduleSpecifier: './types.js', exportClause: '*' },
    ];

    return {
      header: '// GENERATED CODE - DO NOT MODIFY BY HAND',
      imports,
      classes: [sdkClass],
      exports,
    };
  }

  ensure(node: SourceFile): void {
    const schema = this.getSchema(node);
    const sdkClass = schema.classes?.[0];

    if (sdkClass) {
      const existing = node.getClass(sdkClass.name);
      if (existing) {
        existing.remove();
      }
    }

    super.ensure(node);
  }
}
