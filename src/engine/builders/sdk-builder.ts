import {
  type ModelDef,
  type FileDefinition,
  type ClassDefinition,
  type MethodConfig,
  type CustomRoute,
  type ImportConfig,
  type NodeContainer,
} from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';

export class SdkBuilder extends BaseBuilder {
  constructor(
    private model: ModelDef,
    private customRoutes: CustomRoute[] = [],
  ) {
    super();
  }

  private getRole(action: string): string {
    const roleConfig = this.model.role;
    if (!roleConfig) return 'member';
    if (typeof roleConfig === 'string') return roleConfig;
    return roleConfig[action] || 'member';
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    const entityName = this.model.name;
    const sdkName = `${entityName}SDK`;
    const kebabEntity = entityName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
    const endpoint = entityName === 'Root' ? '' : kebabEntity;

    const methods: MethodConfig[] = [];

    // Add standard CRUD only if DB model
    if (this.model.db !== false) {
      // LIST
      if (this.getRole('list') !== 'none') {
        methods.push({
          name: 'list',
          isAsync: true,
          isStatic: false,
          returnType: `Promise<{ success: boolean; data: ${entityName}[]; error?: string; meta: { total: number } }>`,
          parameters: [
            {
              name: 'params',
              type: '{ search?: string; take?: number; skip?: number; orderBy?: string | Record<string, "asc" | "desc">; filters?: Record<string, unknown> }',
              optional: true,
            },
          ],
          statements: [TemplateLoader.load('sdk/list.tsf', { endpoint })],
        });
      }

      // GET
      if (this.getRole('get') !== 'none') {
        methods.push({
          name: 'get',
          isAsync: true,
          isStatic: false,
          returnType: `Promise<{ success: boolean; data: ${entityName}; error?: string }>`,
          parameters: [{ name: 'id', type: 'string' }],
          statements: [TemplateLoader.load('sdk/get.tsf', { endpoint })],
        });
      }

      // CREATE
      if (this.getRole('create') !== 'none') {
        methods.push({
          name: 'create',
          isAsync: true,
          isStatic: false,
          returnType: `Promise<{ success: boolean; data: ${entityName}; error?: string }>`,
          parameters: [{ name: 'data', type: `Partial<${entityName}>` }],
          statements: [TemplateLoader.load('sdk/create.tsf', { endpoint })],
        });
      }

      // UPDATE
      if (this.getRole('update') !== 'none') {
        methods.push({
          name: 'update',
          isAsync: true,
          isStatic: false,
          returnType: `Promise<{ success: boolean; data: ${entityName}; error?: string }>`,
          parameters: [
            { name: 'id', type: 'string' },
            { name: 'data', type: `Partial<${entityName}>` },
          ],
          statements: [TemplateLoader.load('sdk/update.tsf', { endpoint })],
        });
      }

      // DELETE
      if (this.getRole('delete') !== 'none') {
        methods.push({
          name: 'delete',
          isAsync: true,
          isStatic: false,
          returnType: `Promise<{ success: boolean; error?: string }>`,
          parameters: [{ name: 'id', type: 'string' }],
          statements: [TemplateLoader.load('sdk/delete.tsf', { endpoint })],
        });
      }
    }

    // Add Custom Routes
    for (const route of this.customRoutes) {
      const pathParams = route.path.match(/\[(\w+)\]/g)?.map((p) => p.slice(1, -1)) || [];

      const defaultOutput = route.verb === 'DELETE' ? 'void' : 'unknown';
      let outputType = route.output || defaultOutput;
      if (outputType === 'none') outputType = 'void';

      const methodConfig: MethodConfig = {
        name: route.method,
        isAsync: true,
        isStatic: false,
        returnType: `Promise<{ success: boolean; data: ${outputType}; error?: string }>`,
        parameters: pathParams.map((p) => ({ name: p, type: 'string' })),
        statements: [],
      };

      let url = route.path.startsWith('/') ? route.path : `/${route.path}`;
      // Replace [param] with ${param} for template literal
      url = url.replace(/\[(\w+)\]/g, '${$1}');

      if (['POST', 'PUT', 'PATCH'].includes(route.verb) && route.input !== 'none') {
        const inputType = route.input || 'unknown';
        methodConfig.parameters!.push({ name: 'data', type: inputType });
      }

      const dataArg =
        ['POST', 'PUT', 'PATCH'].includes(route.verb) && route.input !== 'none' ? ', data' : '';

      methodConfig.statements!.push(
        TemplateLoader.load('sdk/custom.tsf', {
          verb: route.verb,
          endpoint,
          url,
          dataArg,
        }),
      );

      methods.push(methodConfig);
    }

    const sdkClass: ClassDefinition = {
      name: sdkName,
      isExported: true,
      extends: 'BaseResource',
      methods: methods,
      docs: [`SDK client for ${entityName}.`],
    };

    const imports: ImportConfig[] = [
      { moduleSpecifier: '@nexical/sdk-core', namedImports: ['BaseResource'] },
    ];

    // Entity Type (Always from ./types.ts which re-exports/defines everything)
    // Skip if virtual model with no fields (e.g. Auth grouping)
    const namedImports: string[] = [];
    if (Object.keys(this.model.fields).length > 0 || this.model.db !== false) {
      namedImports.push(entityName);
    }

    // Collect other types from custom routes
    const otherTypes = new Set<string>();
    for (const route of this.customRoutes) {
      // Only import input types if they're actually used in the method signature
      // Skip if input is 'none' or if the verb doesn't accept a body
      const acceptsBody = ['POST', 'PUT', 'PATCH'].includes(route.verb);
      if (
        acceptsBody &&
        route.input &&
        route.input !== 'any' &&
        route.input !== 'none' &&
        route.input !== entityName
      )
        otherTypes.add(route.input.replace('[]', ''));
      if (
        route.output &&
        route.output !== 'any' &&
        route.output !== 'none' &&
        route.output !== entityName
      )
        otherTypes.add(route.output.replace('[]', ''));
    }

    if (namedImports.length > 0 || otherTypes.size > 0) {
      const typesToImport = [...namedImports, ...Array.from(otherTypes)].filter(
        (t) => t !== 'void' && t !== 'any',
      );
      if (typesToImport.length > 0) {
        imports.push({
          moduleSpecifier: './types.js',
          namedImports: typesToImport,
          isTypeOnly: true,
        });
      }
    }

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports: imports,
      classes: [sdkClass],
    };
  }
}
