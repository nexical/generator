import {
  type ModelDef,
  type FileDefinition,
  type MethodConfig,
  type ClassDefinition,
  type NodeContainer,
  type StatementConfig,
  type ParsedStatement,
} from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';
import { ts } from '../primitives/statements/factory.js';

export class ServiceBuilder extends BaseBuilder {
  constructor(
    private model: ModelDef,
    private enableDelete: boolean = true,
  ) {
    super();
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    const entityName = this.model.name;
    const serviceName = `${entityName}Service`;
    const lowerEntity = entityName.charAt(0).toLowerCase() + entityName.slice(1);

    const getClass = (n: unknown) =>
      n && typeof n === 'object' && 'getClass' in n
        ? (
            n as unknown as {
              getClass(name: string): {
                getMethod(name: string): { getBodyText(): string } | undefined;
                getStaticMethod(name: string): { getBodyText(): string } | undefined;
              } | null;
            }
          ).getClass(serviceName)
        : null;
    const getExistingStatements = (
      n: unknown,
      methodName: string,
    ): StatementConfig[] | undefined => {
      const cls = getClass(n);
      const method = cls?.getMethod(methodName) || cls?.getStaticMethod(methodName);
      const body = method?.getBodyText();
      return body ? [ts`${body}`] : undefined;
    };

    // Helper to generate standard error block uses Logger
    const errorBlock = (action: string) => `
                        Logger.error("${entityName} ${action} Error", error);
                        return { success: false, error: "${lowerEntity}.service.error.${action}_failed" };
                    `;

    const loadTemplate = (fileName: string, action: string) => {
      return TemplateLoader.load(`service/crud/${fileName}.tsf`, {
        lowerEntity,
        entityName,
        errorBlock: errorBlock(action),
      });
    };

    const methods: MethodConfig[] = [
      // LIST
      {
        name: 'list',
        isStatic: true,
        isAsync: true,
        returnType: `Promise<ServiceResponse<${entityName}[]>>`,
        parameters: [
          { name: 'params', type: `Prisma.${entityName}FindManyArgs`, optional: true },
          { name: 'actor', type: 'ApiActor', optional: true },
        ],
        statements: getExistingStatements(node, 'list') || [loadTemplate('list', 'list')],
      },
      // GET
      {
        name: 'get',
        isStatic: true,
        isAsync: true,
        returnType: `Promise<ServiceResponse<${entityName} | null>>`,
        parameters: [
          { name: 'id', type: 'string' },
          { name: 'select', type: `Prisma.${entityName}Select`, optional: true },
          { name: 'actor', type: 'ApiActor', optional: true },
        ],
        statements: getExistingStatements(node, 'get') || [loadTemplate('get', 'get')],
      },
      // CREATE
      {
        name: 'create',
        isStatic: true,
        isAsync: true,
        returnType: `Promise<ServiceResponse<${entityName}>>`,
        parameters: [
          { name: 'data', type: `Prisma.${entityName}CreateInput` },
          { name: 'select', type: `Prisma.${entityName}Select`, optional: true },
          { name: 'actor', type: 'ApiActor', optional: true },
        ],
        statements: getExistingStatements(node, 'create') || [loadTemplate('create', 'create')],
      },
      // UPDATE
      {
        name: 'update',
        isStatic: true,
        isAsync: true,
        returnType: `Promise<ServiceResponse<${entityName}>>`,
        parameters: [
          { name: 'id', type: 'string' },
          { name: 'data', type: `Prisma.${entityName}UpdateInput` },
          { name: 'select', type: `Prisma.${entityName}Select`, optional: true },
          { name: 'actor', type: 'ApiActor', optional: true },
        ],
        statements: getExistingStatements(node, 'update') || [loadTemplate('update', 'update')],
      },
      // DELETE
      ...(this.enableDelete
        ? [
            {
              name: 'delete',
              isStatic: true,
              isAsync: true,
              returnType: `Promise<ServiceResponse<void>>`,
              parameters: [
                { name: 'id', type: 'string' },
                { name: 'actor', type: 'ApiActor', optional: true },
              ],
              statements: getExistingStatements(node, 'delete') || [
                loadTemplate('delete', 'delete'),
              ],
            },
          ]
        : [
            {
              name: 'delete',
              isStatic: true,
              isAsync: true,
              returnType: `Promise<ServiceResponse<void>>`,
              parameters: [
                { name: 'id', type: 'string' },
                { name: 'actor', type: 'ApiActor', optional: true },
              ],
              statements: [loadTemplate('delete-blocked', 'delete')],
            },
          ]),
    ];

    const serviceClass: ClassDefinition = {
      name: serviceName,
      isExported: true,
      methods: methods,
      docs: [`Service class for ${entityName}-related business logic.`],
    };

    const imports = [
      { moduleSpecifier: '@/lib/core/db', namedImports: ['db'] },
      { moduleSpecifier: '@/types/service', namedImports: ['ServiceResponse'], isTypeOnly: true },
      { moduleSpecifier: '@/lib/modules/hooks', namedImports: ['HookSystem'] },
      { moduleSpecifier: '@prisma/client', namedImports: [entityName, 'Prisma'], isTypeOnly: true },
      { moduleSpecifier: '@/lib/api/api-docs', namedImports: ['ApiActor'], isTypeOnly: true },
    ];

    const hasLogger = methods.some((m) =>
      m.statements?.some((s) => {
        const text = 'raw' in s ? (s as ParsedStatement).raw : '';
        return text.includes('Logger.');
      }),
    );
    if (hasLogger) {
      imports.push({ moduleSpecifier: '@/lib/core/logger', namedImports: ['Logger'] });
    }

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports: imports,
      classes: [serviceClass],
    };
  }
}
