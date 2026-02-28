import {
  type ModelDef,
  type FileDefinition,
  type VariableConfig,
  type ImportConfig,
  type CustomRoute,
  type NodeContainer,
} from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';

export class ApiBuilder extends BaseBuilder {
  constructor(
    private model: ModelDef,
    private allModels: ModelDef[],
    private moduleName: string, // e.g. "user-api"
    private type: 'collection' | 'individual' | 'custom',
    private routes?: CustomRoute[], // For custom type
  ) {
    super();
  }

  private get moduleTypesNamespace(): string {
    return (
      this.moduleName
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join('') + 'ModuleTypes'
    );
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    if (this.type === 'collection') {
      return this.getCollectionSchema();
    } else if (this.type === 'individual') {
      return this.getIndividualSchema();
    } else {
      return this.getCustomSchema();
    }
  }

  private getRole(action: string): string {
    // ... existing getRole logic ...
    const roleConfig = this.model.role;
    if (!roleConfig) return 'member';
    if (typeof roleConfig === 'string') return roleConfig;
    return roleConfig[action] || 'member';
  }

  private generateZodSchema(): string {
    // ... existing generateZodSchema logic ...
    const fields = Object.entries(this.model.fields)
      .filter(([name, f]) => {
        const typeName = f.type.replace('[]', '');
        const isModel = this.allModels.some((m) => m.name === typeName);
        const isIdWithDefault =
          name === 'id' && f.attributes?.some((a) => a.startsWith('@default'));
        return (
          (!['id', 'createdAt', 'updatedAt'].includes(name) ||
            (name === 'id' && !isIdWithDefault)) &&
          f.api !== false &&
          !f.private &&
          !f.isRelation &&
          !isModel
        );
      })
      .map(([name, f]) => {
        let validator = 'z.';
        if (f.isEnum) {
          validator += `nativeEnum(${this.moduleTypesNamespace}.${f.type})`;
        } else {
          switch (f.type) {
            case 'Int':
              validator += 'number().int()';
              break;
            case 'Float':
            case 'Decimal':
              validator += 'number()';
              break;
            case 'Boolean':
              validator += 'boolean()';
              break;
            case 'DateTime':
              validator += 'string().datetime()';
              break;
            case 'Json':
              validator += 'unknown()';
              break;
            default:
              validator += 'string()';
          }
        }
        if (f.isList) {
          validator = `z.array(${validator})`;
        }
        if (!f.isRequired || f.isRelation || f.attributes?.some((a) => a.startsWith('@default'))) {
          validator += '.optional()';
        }
        return `${name}: ${validator}`;
      });

    if (fields.length === 0) {
      return `z.object({}).passthrough()`;
    }

    return `z.object({
        ${fields.join(',\n        ')}
    })`;
  }

  private generateSelectObject(): string {
    const fields = Object.entries(this.model.fields)
      .filter(([name, f]) => f.api !== false && !f.private)
      .map(([name, f]) => {
        const props: string[] = [];

        // Performance: Limit relation lists
        // Robust check for list types (handle arrays or explicit isList flag)
        if (f.isRelation && (f.isList || f.type.trim().endsWith('[]'))) {
          // Default limit for nested lists to prevent performance issues
          props.push('take: 10');
        }

        // Security: Filter private fields in relations
        if (f.isRelation && f.relationTo) {
          const targetModel = this.allModels.find((m) => m.name === f.relationTo);
          if (targetModel) {
            const privateFields = Object.values(targetModel.fields).filter(
              (tf) => tf.private || tf.api === false,
            );
            if (privateFields.length > 0) {
              const targetFields = Object.entries(targetModel.fields)
                .filter(([_, tf]) => tf.api !== false && !tf.private)
                .map(([tfName]) => `${tfName}: true`);

              props.push(`select: {
                    ${targetFields.join(',\n                    ')}
                }`);
            }
          }
        }

        if (props.length > 0) {
          return `${name}: { ${props.join(', ')} }`;
        }

        return `${name}: true`;
      });

    if (fields.length === 0) return '{}';

    return `{
            ${fields.join(',\n            ')}
        }`;
  }

  private generateResponseSchema(modelName: string, isList: boolean = false): string {
    const jsonSchema = this.generateJsonSchema(modelName);

    if (isList) {
      return `{
                type: "object",
                properties: {
                    data: {
                        type: "array",
                        items: ${jsonSchema}
                    },
                    meta: {
                        type: "object",
                        properties: {
                            total: { type: "integer" }
                        }
                    }
                }
            }`;
    }

    return jsonSchema;
  }

  private getCollectionSchema(): FileDefinition {
    // ... existing getCollectionSchema logic ...
    const entityName = this.model.name;
    const serviceName = `${entityName}Service`;
    const kebabName = entityName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
    const serviceImport = `@modules/${this.moduleName}/src/services/${kebabName}-service`;

    const listRole = this.getRole('list');
    const createRole = this.getRole('create');

    const filterFields = Object.entries(this.model.fields)
      .filter(
        ([_, f]) =>
          (f.type === 'String' ||
            f.type === 'Boolean' ||
            f.type === 'Int' ||
            f.type === 'DateTime' ||
            f.isEnum) &&
          f.api !== false &&
          !f.isList,
      )
      .map(([name, f]) => {
        let type = f.type.toLowerCase();
        if (f.type === 'Int') type = 'number';
        if (f.type === 'DateTime') type = 'date';
        if (f.isEnum) type = 'enum';
        return `${name}: '${type}'`;
      })
      .join(',\n        ');

    const searchFields = Object.entries(this.model.fields)
      .filter(([_, f]) => f.type === 'String' && f.api !== false && !f.isList)
      .map(([name]) => `'${name}'`)
      .join(', ');

    const zodSchema = this.generateZodSchema();
    const selectObject = this.generateSelectObject();

    const jsonSchema = this.generateJsonSchema(this.model.name);
    const listResponseSchema = this.generateResponseSchema(this.model.name, true);

    // Generate allowed operators docs
    const parameterDocs: string[] = [];
    parameterDocs.push('{ name: "take", in: "query", schema: { type: "integer" } }');
    parameterDocs.push('{ name: "skip", in: "query", schema: { type: "integer" } }');
    parameterDocs.push('{ name: "search", in: "query", schema: { type: "string" } }');
    parameterDocs.push(
      '{ name: "orderBy", in: "query", schema: { type: "string" }, description: "Ordering (format: field:asc or field:desc)" }',
    );

    for (const [name, f] of Object.entries(this.model.fields)) {
      if (f.api === false) continue;

      let type = 'string';
      let operators = ['eq', 'ne', 'in']; // Default (Enum)

      if (f.type === 'String') {
        operators = ['eq', 'ne', 'contains', 'startsWith', 'endsWith', 'in'];
      } else if (f.type === 'Int' || f.type === 'Float') {
        type = 'number';
        operators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'];
      } else if (f.type === 'Boolean') {
        type = 'boolean';
        operators = ['eq', 'ne'];
      } else if (f.type === 'DateTime') {
        operators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'];
      }

      for (const op of operators) {
        parameterDocs.push(
          `{ name: "${name}.${op}", in: "query", schema: { type: "${type}" }, required: false, description: "Filter by ${name} (${op})" }`,
        );
      }
      // Add shorthand 'eq'
      parameterDocs.push(
        `{ name: "${name}", in: "query", schema: { type: "${type}" }, required: false, description: "Filter by ${name} (eq)" }`,
      );
    }

    const variables: VariableConfig[] = [];

    if (listRole !== 'none') {
      const listDocs = `{
    summary: "List ${entityName}s",
    tags: ["${entityName}"],
    parameters: [
        ${parameterDocs.join(',\n        ')}
    ],
    responses: {
        200: {
            description: "OK",
            content: {
                "application/json": {
                    schema: ${listResponseSchema}
                }
            }
        }
    }${['anonymous', 'public'].includes(listRole) ? ',\n    protected: false' : ''}
}`;

      variables.push({
        name: 'GET',
        declarationKind: 'const',
        isExported: true,
        initializer: TemplateLoader.load('api/collection/list.tsf', {
          filterFields,
          searchFields,
          listRole,
          selectObject,
          serviceName,
          entityName,
          lowerEntity: entityName.charAt(0).toLowerCase() + entityName.slice(1),
          docs: listDocs,
        }),
      });
    }

    if (createRole !== 'none') {
      const createDocs = `{
    summary: "Create ${entityName}",
    tags: ["${entityName}"],
    requestBody: {
        content: {
            "application/json": {
                schema: ${jsonSchema}
            }
        }
    },
    responses: {
        200: {
            description: "OK",
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {
                            data: ${jsonSchema}
                        }
                    }
                }
            }
        }
    }${['anonymous', 'public'].includes(createRole) ? ',\n    protected: false' : ''}
}`;

      variables.push({
        name: 'POST',
        declarationKind: 'const',
        isExported: true,
        initializer: TemplateLoader.load('api/collection/create.tsf', {
          createRole,
          zodSchema,
          selectObject,
          serviceName,
          entityName,
          docs: createDocs,
        }),
      });
    }

    const usedEnums = Object.values(this.model.fields)
      .filter((f) => f.isEnum && f.api !== false && !f.private)
      .map((f) => f.type)
      .filter((value, index, self) => self.indexOf(value) === index);

    const imports: ImportConfig[] = [
      { moduleSpecifier: '@/lib/api/api-docs', namedImports: ['defineApi'] },
      { moduleSpecifier: '@/lib/api/api-guard', namedImports: ['ApiGuard'] },
      { moduleSpecifier: '@/lib/api/api-query', namedImports: ['parseQuery'] },
      { moduleSpecifier: '@/lib/modules/hooks', namedImports: ['HookSystem'] },
      { moduleSpecifier: 'zod', namedImports: ['z'] },
      { moduleSpecifier: serviceImport, namedImports: [serviceName] },
    ];

    if (usedEnums.length > 0) {
      imports.push({
        moduleSpecifier: '@/lib/api',
        namedImports: [this.moduleTypesNamespace],
        isTypeOnly: true,
      });
    }

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports,
      variables,
    };
  }

  private getIndividualSchema(): FileDefinition {
    // ... existing getIndividualSchema logic ...
    const entityName = this.model.name;
    const serviceName = `${entityName}Service`;
    const kebabName = entityName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
    const serviceImport = `@modules/${this.moduleName}/src/services/${kebabName}-service`;

    const getRole = this.getRole('get');
    const updateRole = this.getRole('update');
    const deleteRole = this.getRole('delete');

    const zodSchema = this.generateZodSchema()
      .replace(/z\.object\({/, 'z.object({')
      .replace(/}\)$/, '}).partial()');
    const selectObject = this.generateSelectObject();

    // Generate Partial JSON Schema for Update
    const jsonSchema = this.generateJsonSchema(this.model.name);
    const partialJsonSchema = jsonSchema.replace(/, required: \[.*?\]/, ''); // Remove required for partial update

    const variables: VariableConfig[] = [];

    if (getRole !== 'none') {
      const getDocs = `{
    summary: "Get ${entityName}",
    tags: ["${entityName}"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    responses: {
        200: {
            description: "OK",
            content: {
                "application/json": {
                    schema: ${jsonSchema}
                }
            }
        }
    }${['anonymous', 'public'].includes(getRole) ? ',\n    protected: false' : ''}
}`;

      variables.push({
        name: 'GET',
        declarationKind: 'const',
        isExported: true,
        initializer: TemplateLoader.load('api/individual/get.tsf', {
          getRole,
          selectObject,
          serviceName,
          entityName,
          docs: getDocs,
        }),
      });
    }

    if (updateRole !== 'none') {
      const updateDocs = `{
    summary: "Update ${entityName}",
    tags: ["${entityName}"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    requestBody: {
        content: {
            "application/json": {
                schema: ${partialJsonSchema}
            }
        }
    },
    responses: {
        200: {
            description: "OK",
            content: {
                "application/json": {
                    schema: ${jsonSchema}
                }
            }
        }
    }${['anonymous', 'public'].includes(updateRole) ? ',\n    protected: false' : ''}
}`;

      variables.push({
        name: 'PUT',
        declarationKind: 'const',
        isExported: true,
        initializer: TemplateLoader.load('api/individual/update.tsf', {
          updateRole,
          zodSchema,
          selectObject,
          serviceName,
          entityName,
          docs: updateDocs,
        }),
      });
    }

    if (deleteRole !== 'none') {
      const deleteDocs = `{
    summary: "Delete ${entityName}",
    tags: ["${entityName}"],
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    responses: {
        200: {
            description: "OK",
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" }
                        }
                    }
                }
            }
        }
    }${['anonymous', 'public'].includes(deleteRole) ? ',\n    protected: false' : ''}
}`;

      variables.push({
        name: 'DELETE',
        declarationKind: 'const',
        isExported: true,
        initializer: TemplateLoader.load('api/individual/delete.tsf', {
          deleteRole,
          serviceName,
          entityName,
          docs: deleteDocs,
        }),
      });
    }

    const usedEnums = Object.values(this.model.fields)
      .filter((f) => f.isEnum && f.api !== false && !f.private)
      .map((f) => f.type)
      .filter((value, index, self) => self.indexOf(value) === index);

    const imports: ImportConfig[] = [
      { moduleSpecifier: '@/lib/api/api-docs', namedImports: ['defineApi'] },
      { moduleSpecifier: '@/lib/api/api-guard', namedImports: ['ApiGuard'] },
      { moduleSpecifier: 'zod', namedImports: ['z'] },
      { moduleSpecifier: serviceImport, namedImports: [serviceName] },
    ];

    if (usedEnums.length > 0) {
      imports.push({
        moduleSpecifier: '@/lib/api',
        namedImports: [this.moduleTypesNamespace],
        isTypeOnly: true,
      });
    }

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports,
      variables,
    };
  }

  private generateJsonSchema(modelName: string): string {
    const model = this.allModels.find((m) => m.name === modelName);
    if (!model) return '{ type: "object" }';

    const properties: string[] = [];
    const required: string[] = [];

    for (const [name, field] of Object.entries(model.fields)) {
      if (field.api === false || field.private) continue;

      let type = 'string';
      let format = '';

      if (field.type === 'Int' || field.type === 'Float') type = 'number';
      else if (field.type === 'Boolean') type = 'boolean';
      else if (field.type === 'Json') type = 'object';
      else if (field.type === 'DateTime') {
        type = 'string';
        format = ', format: "date-time"';
      }

      let schemaProp = `{ type: "${type}"${format} }`;

      if (field.isList) {
        schemaProp = `{ type: "array", items: ${schemaProp} }`;
      }

      properties.push(`${name}: ${schemaProp}`);

      if (field.isRequired && !field.attributes?.some((a) => a.startsWith('@default'))) {
        required.push(`"${name}"`);
      }
    }

    const requiredStr = required.length > 0 ? `, required: [${required.join(', ')}]` : '';

    return `{
            type: "object",
            properties: {
                ${properties.join(',\n                ')}
            }${requiredStr}
        }`;
  }

  private getCustomSchema(): FileDefinition {
    if (!this.routes || this.routes.length === 0) return { variables: [] };

    const variables: VariableConfig[] = [];
    const imports: ImportConfig[] = [
      { moduleSpecifier: '@/lib/api/api-docs', namedImports: ['defineApi'] },
      { moduleSpecifier: '@/lib/api/api-guard', namedImports: ['ApiGuard'] },
      { moduleSpecifier: '@/lib/modules/hooks', namedImports: ['HookSystem'] },
    ];

    for (const route of this.routes) {
      const { method, verb, input, output, role } = route;
      console.info(`[ApiBuilder] Processing route: ${verb} ${method}, input: ${input}`);
      const entityName = this.model.name;
      // ... (rest of variable setup, entityName, etc)
      const kebabName = entityName
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();

      const kebabMethod = method.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      const actionBase =
        route.action ||
        (kebabMethod.includes(kebabName) ? kebabMethod : `${kebabMethod}-${kebabName}`);

      const methodPascal = method.charAt(0).toUpperCase() + method.slice(1);
      const actionClassName = route.action
        ? route.action
            .split('-')
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join('') + 'Action'
        : (methodPascal.includes(entityName) ? methodPascal : `${methodPascal}${entityName}`) +
          'Action';

      const actionImport = `@modules/${this.moduleName}/src/actions/${actionBase}`;

      if (!imports.find((i) => i.moduleSpecifier === actionImport)) {
        imports.push({ moduleSpecifier: actionImport, namedImports: [actionClassName] });
      }

      let requestBodySchema = '{ type: "object" }';

      // Resolve schemas for DTOs
      const pascalModule = this.moduleName
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join('');
      const moduleTypesNamespace = `${pascalModule}ModuleTypes`;

      if (input && input !== 'unknown' && (input.endsWith('DTO') || input.endsWith('Input'))) {
        const sdkTypes = '@/lib/api';
        const existing = imports.find((i) => i.moduleSpecifier === sdkTypes);
        if (existing) {
          if (!existing.namedImports?.includes(moduleTypesNamespace))
            existing.namedImports?.push(moduleTypesNamespace);
        } else {
          imports.push({
            moduleSpecifier: sdkTypes,
            namedImports: [moduleTypesNamespace],
            isTypeOnly: true,
          });
        }
        requestBodySchema = this.generateJsonSchema(input);
      }

      let responseSchema = '{ type: "object" }';
      if (output && output !== 'unknown') {
        // Try to resolve output type schema
        // If it's a model
        if (this.allModels.some((m) => m.name === output.replace('[]', ''))) {
          const isList = output.endsWith('[]');
          const modelName = output.replace('[]', '');
          const schema = this.generateJsonSchema(modelName);
          if (isList) {
            responseSchema = `{ type: "array", items: ${schema} }`;
          } else {
            responseSchema = schema;
          }
        } else if (output.endsWith('DTO') || output.endsWith('Response')) {
          // Try generated schema for DTO
          const sdkTypes = '@/lib/api';
          const existing = imports.find((i) => i.moduleSpecifier === sdkTypes);
          if (existing) {
            if (!existing.namedImports?.includes(moduleTypesNamespace))
              existing.namedImports?.push(moduleTypesNamespace);
          } else {
            imports.push({
              moduleSpecifier: sdkTypes,
              namedImports: [moduleTypesNamespace],
              isTypeOnly: true,
            });
          }
          responseSchema = this.generateJsonSchema(output);
        }
      }

      const customDocs = `{
    summary: "${route.summary || ''}",
    tags: ["${this.model.name}"],
    ${
      verb !== 'GET'
        ? `requestBody: {
        content: {
            "application/json": {
                schema: ${requestBodySchema}
            }
        }
    },`
        : ''
    }
    responses: {
        200: {
            description: "OK",
            content: {
                "application/json": {
                    schema: ${responseSchema}
                }
            }
        }
    }${['anonymous', 'public'].includes(role || '') ? ',\n        protected: false' : ''}
}`;
      console.info(
        `[ApiBuilder] Generated docs for ${method}: role=${role}, protected=${['anonymous', 'public'].includes(role || '')}`,
      );

      const bodyLoader = verb === 'GET' ? '{}' : 'await context.request.json()';

      variables.push({
        name: verb,
        declarationKind: 'const',
        isExported: true,
        initializer: TemplateLoader.load('api/custom/handler.tsf', {
          verb: verb,
          bodyLoader,
          inputType:
            input && !['none', 'void', 'unknown', 'any'].includes(input)
              ? `${moduleTypesNamespace}.${input}`
              : 'unknown',
          entityName: this.model.name,
          lowerEntity: this.model.name.charAt(0).toLowerCase() + this.model.name.slice(1),
          method,
          role: role || 'member',
          actionClassName,
          docs: customDocs,
        }),
      });
    }

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports,
      variables,
    };
  }
}
