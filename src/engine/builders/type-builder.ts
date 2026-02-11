import {
  type ModelDef,
  type FileDefinition,
  type InterfaceConfig,
  type EnumConfig,
  type NodeContainer,
  type ImportConfig,
  type StatementConfig,
} from '../types.js';
import { BaseBuilder } from './base-builder.js';

export class TypeBuilder extends BaseBuilder {
  constructor(
    private models: ModelDef[],
    private enums: EnumConfig[] = [],
  ) {
    super();
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    const dbModels = this.models.filter((m) => m.db);
    const virtualModels = this.models.filter((m) => !m.db);

    const interfaces: InterfaceConfig[] = [];
    const imports: ImportConfig[] = [];
    const exportsConfig = [];

    // Deduplicate enums by name
    const enums: EnumConfig[] = [];
    const enumNames = new Set<string>();
    for (const e of this.enums) {
      if (!enumNames.has(e.name)) {
        enums.push(e);
        enumNames.add(e.name);
      }
    }

    const statements: StatementConfig[] = [];

    // 1. Identify used database models in virtual model fields
    const usedDbModels = new Set<string>();
    for (const model of virtualModels) {
      for (const field of Object.values(model.fields)) {
        if (dbModels.some((dm) => dm.name === field.type)) {
          usedDbModels.add(field.type);
        }
      }
    }

    if (dbModels.length > 0) {
      const namedImports = dbModels.map((m) => m.name).filter((name) => usedDbModels.has(name));

      if (namedImports.length > 0) {
        imports.push({
          moduleSpecifier: '@prisma/client',
          namedImports: namedImports,
          isTypeOnly: true,
        });
      }

      exportsConfig.push({
        moduleSpecifier: '@prisma/client',
        exportClause: dbModels.map((m) => m.name),
        isTypeOnly: true,
      });
    }

    // 2. Generate Interfaces for Virtual Models
    for (const model of virtualModels) {
      const properties = Object.entries(model.fields).map(([fieldName, field]) => {
        let type = field.type;
        // Map basic types or keep as is
        if (type === 'String') type = 'string';
        if (type === 'Int') type = 'number';
        if (type === 'Float') type = 'number';
        if (type === 'Boolean') type = 'boolean';
        if (type === 'DateTime') type = 'Date';
        if (type === 'Json') type = 'unknown';

        if (field.isList) type = `${type}[]`;

        return {
          name: fieldName,
          type: type,
          optional: !field.isRequired,
        };
      });

      if (properties.length === 0) {
        interfaces.push({
          name: model.name,
          isExported: true,
          properties,
          comments: ['// eslint-disable-next-line @typescript-eslint/no-empty-object-type'],
        });
      } else {
        interfaces.push({
          name: model.name,
          isExported: true,
          properties,
        });
      }
    }

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports: imports,
      exports: exportsConfig,
      enums: enums,
      interfaces: interfaces,
      statements: statements,
    };
  }
}
