import { BaseCommand } from '@nexical/cli-core';
import fs from 'fs';
import path from 'path';
import { Project, SourceFile } from 'ts-morph';
import YAML from 'yaml';
import {
  PlatformDefinitionSchema,
  PlatformApiDefinitionSchema,
  type PlatformDefinition,
  type PlatformModel,
} from '../schema.js';

// Builders
import { ModelParser } from '../engine/model-parser.js';
import { ServiceBuilder } from '../engine/builders/service-builder.js';
import { ApiBuilder } from '../engine/builders/api-builder.js';
import { SdkBuilder } from '../engine/builders/sdk-builder.js';
import { SdkIndexBuilder } from '../engine/builders/sdk-index-builder.js';
import { InitBuilder } from '../engine/builders/init-builder.js';
import { TestBuilder } from '../engine/builders/test-builder.js';
import { ActionBuilder } from '../engine/builders/action-builder.js';
import { TypeBuilder } from '../engine/builders/type-builder.js';
import { FactoryBuilder } from '../engine/builders/factory-builder.js';
import { ActorBuilder } from '../engine/builders/actor-builder.js';
import { ActorTypeBuilder } from '../engine/builders/actor-type-builder.js';
import { type ModelDef, type CustomRoute } from '../engine/types.js';
import { ModuleLocator, type ModuleInfo } from '../lib/module-locator.js';
import { type BaseBuilder } from '../engine/builders/base-builder.js';

export async function auditApiModule(
  command: BaseCommand,
  name: string | undefined,
  options: { schema?: boolean },
) {
  const pattern = name || '*-api';
  const modules = await ModuleLocator.expand(pattern);

  if (modules.length === 0) {
    command.warn(`No modules found matching pattern "${pattern}"`);
    return;
  }

  command.info(`Found ${modules.length} module(s) to audit.`);

  let totalIssues: string[] = [];

  for (const moduleInfo of modules) {
    command.info(`Auditing module: ${moduleInfo.name} `);
    const issues = await auditModule(command, moduleInfo, options.schema || false);
    totalIssues = totalIssues.concat(issues);
  }

  if (totalIssues.length > 0) {
    command.error(`Audit failed with ${totalIssues.length} issues: `);
    totalIssues.forEach((issue) => command.info(issue));
    // command.error usually exits, but if we want to mimic process.exitCode = 1 without immediate exit if possible:
    // BaseCommand implementation of error() usually calls exit(1).
    // If we want to return without exit, we'd use command.log/warn.
    // But original code set process.exitCode = 1, implying failure state.
    // BaseCommand triggers failure.
  } else {
    command.success(`Audit passed for all ${modules.length} modules.`);
  }
}

export async function auditModule(
  command: BaseCommand,
  moduleInfo: ModuleInfo,
  checkSchemaOnly: boolean,
): Promise<string[]> {
  const { name, path: moduleDir } = moduleInfo;
  const modelsPath = path.join(moduleDir, 'models.yaml');
  const apiPath = path.join(moduleDir, 'api.yaml');

  const issues: string[] = [];
  const report = (msg: string) => issues.push(`[${name}] ${msg} `);

  try {
    // 1. Schema Validation
    if (!fs.existsSync(modelsPath)) {
      report(`models.yaml not found at: ${modelsPath} `);
      return issues;
    }

    const modelsContent = fs.readFileSync(modelsPath, 'utf8');
    let parsedModels: PlatformDefinition;
    try {
      parsedModels = YAML.parse(modelsContent);
    } catch (e: unknown) {
      report(`Failed to parse models.yaml: ${e instanceof Error ? e.message : String(e)} `);
      return issues;
    }

    // Validate against Zod Schema
    const modelResult = PlatformDefinitionSchema.safeParse(parsedModels);
    if (!modelResult.success) {
      report(`[Schema] models.yaml validation errors: `);
      modelResult.error.errors.forEach((err) => {
        report(`  Path: ${err.path.join('.')} - ${err.message} `);
      });
    }

    // Validate api.yaml if exists
    if (fs.existsSync(apiPath)) {
      try {
        const apiContent = fs.readFileSync(apiPath, 'utf8');
        const parsedApi = YAML.parse(apiContent);
        const apiResult = PlatformApiDefinitionSchema.safeParse(parsedApi);

        if (!apiResult.success) {
          report(`[Schema] api.yaml validation errors: `);
          apiResult.error.errors.forEach((err) => {
            report(`  Path: ${err.path.join('.')} - ${err.message} `);
          });
        }
      } catch (e: unknown) {
        report(`[Schema] Failed to parse api.yaml: ${e instanceof Error ? e.message : String(e)} `);
      }
    }

    // 2. Semantic Validation (Types & Roles)
    const validTypes = new Set([
      'String',
      'Boolean',
      'Int',
      'BigInt',
      'Float',
      'Decimal',
      'DateTime',
      'Json',
      'Bytes', // Prisma Scalars
      'unknown',
      'any',
      'void', // Special Types
    ]);

    const validRoles = new Set<string>();
    validRoles.add('none'); // "none" is always valid

    // Extract Types from Models & Enums
    if (parsedModels.models) {
      Object.keys(parsedModels.models).forEach((k) => validTypes.add(k));
    }
    if (parsedModels.enums) {
      Object.keys(parsedModels.enums).forEach((k) => validTypes.add(k));
    }

    // Extract Roles from ALL Modules (Cross-Module Scanning)
    // We now scan potential module roots
    const moduleRoots = [
      path.join(process.cwd(), 'apps/backend/modules'),
      path.join(process.cwd(), 'apps/frontend/modules'),
    ];

    for (const root of moduleRoots) {
      if (fs.existsSync(root)) {
        const globalModules = fs.readdirSync(root);
        for (const mod of globalModules) {
          const rolesDir = path.join(root, mod, 'src', 'roles');
          if (fs.existsSync(rolesDir)) {
            const roleFiles = fs.readdirSync(rolesDir).filter((f: string) => f.endsWith('.ts'));
            roleFiles.forEach((f: string) => validRoles.add(path.basename(f, '.ts')));
          }
        }
      }
    }

    // Validate Models.yaml Semantics
    for (const [modelName, modelDef] of Object.entries<PlatformModel>(parsedModels.models || {})) {
      // Validate Fields
      if (modelDef.fields) {
        for (const [fieldName, fieldDef] of Object.entries(modelDef.fields)) {
          const fieldType = typeof fieldDef === 'string' ? fieldDef : fieldDef.type;
          if (!validTypes.has(fieldType)) {
            report(`[Semantic] Model '${modelName}.${fieldName}' has unknown type '${fieldType}'`);
          }
        }
      }

      // Validate Role (String or Map)
      if (modelDef.role) {
        const rolesToCheck: string[] = [];
        if (typeof modelDef.role === 'string') {
          rolesToCheck.push(modelDef.role);
        } else if (typeof modelDef.role === 'object' && modelDef.role !== null) {
          Object.values(modelDef.role).forEach((r: unknown) => rolesToCheck.push(String(r)));
        }

        rolesToCheck.forEach((r) => {
          if (!validRoles.has(r)) {
            report(
              `[Semantic] Model '${modelName}' has unknown role '${r}'. Valid: ${Array.from(validRoles).join(', ')} `,
            );
          }
        });
      }
    }

    // Validate Api.yaml Semantics
    if (fs.existsSync(apiPath)) {
      try {
        const apiContent = fs.readFileSync(apiPath, 'utf8');
        const parsedApi = YAML.parse(apiContent) as Record<string, CustomRoute[]>;

        for (const [entityName, routes] of Object.entries(parsedApi)) {
          routes.forEach((route, idx) => {
            const label = `api.yaml[${entityName}][${idx}] ${route.path} `;

            // Check Input Type
            if (route.input) {
              const inputType = route.input.endsWith('[]') ? route.input.slice(0, -2) : route.input;
              if (!validTypes.has(inputType)) {
                report(`[Semantic] ${label} has unknown input type '${route.input}'`);
              }
            }

            // Check Output Type
            if (route.output) {
              const outputType = route.output.endsWith('[]')
                ? route.output.slice(0, -2)
                : route.output;
              if (!validTypes.has(outputType)) {
                report(`[Semantic] ${label} has unknown output type '${route.output}'`);
              }
            }

            // Check Role
            if (route.role) {
              if (!validRoles.has(route.role)) {
                report(
                  `[Semantic] ${label} has unknown role '${route.role}'. Valid: ${Array.from(validRoles).join(', ')} `,
                );
              }
            }
          });
        }
      } catch {
        // Parsed before, redundant catch but safe
      }
    }

    if (checkSchemaOnly) {
      return issues;
    }

    // 2. Full Code Audit
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        moduleResolution: 2, // Node
        esModuleInterop: true,
        skipLibCheck: true,
        strict: false,
      },
    });
    const { models, enums } = ModelParser.parse(modelsPath); // This also does some validation

    const customRoutes: Record<string, CustomRoute[]> = fs.existsSync(apiPath)
      ? YAML.parse(fs.readFileSync(apiPath, 'utf-8'))
      : {};

    const getFile = (relPath: string): SourceFile | undefined => {
      const absPath = path.join(moduleDir, relPath);
      if (!fs.existsSync(absPath)) {
        report(`[Missing] ${relPath} `);
        return undefined;
      }
      return project.addSourceFileAtPath(absPath);
    };

    const validate = (builder: BaseBuilder, file: SourceFile | undefined, label: string) => {
      if (!file) return;
      const res = builder.validate(file);
      if (!res.valid) {
        res.issues.forEach((i: string) => report(`[${label}] ${i} `));
      }
    };

    // --- Validation Logic Mirrored from ApiModuleGenerator ---

    // 1. Types
    validate(new TypeBuilder(models, enums), getFile('src/sdk/types.ts'), 'SDK Types');

    const processedModels = new Set(models.map((m) => m.name));

    for (const model of models) {
      const entityName = model.name;
      const kebabName = entityName
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();

      // Services
      if (model.db) {
        validate(
          new ServiceBuilder(model),
          getFile(`src/services/${kebabName}-service.ts`),
          `${entityName} Service`,
        );
      }

      if (model.api) {
        if (model.db) {
          validate(
            new ApiBuilder(model, models, name, 'collection'),
            getFile(`src/pages/api/${kebabName}/index.ts`),
            `${entityName}API List`,
          );
          validate(
            new ApiBuilder(model, models, name, 'individual'),
            getFile(`src/pages/api/${kebabName}/[id].ts`),
            `${entityName}API Detail`,
          );
        }

        // Custom Routes
        const modelRoutes = customRoutes[entityName] || [];
        for (const route of modelRoutes) {
          const routePath = route.path.startsWith('/') ? route.path.slice(1) : route.path;
          validate(
            new ApiBuilder(model, models, name, 'custom', [route]),
            getFile(`src/pages/api/${kebabName}/${routePath}.ts`),
            `${entityName}API ${routePath}`,
          );

          const actionName = `${route.method.charAt(0).toUpperCase() + route.method.slice(1)}${entityName}Action`;
          const actionPath = `src/actions/${route.method.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}-${kebabName}.ts`;
          validate(
            new ActionBuilder(actionName, route.input || 'any', route.output || 'any'),
            getFile(actionPath),
            `${entityName}Action`,
          );
        }

        // SDK
        validate(
          new SdkBuilder(model, modelRoutes),
          getFile(`src/sdk/${kebabName}-sdk.ts`),
          `${entityName}SDK`,
        );

        // Tests
        if (model.db) {
          const ops: ('create' | 'list' | 'get' | 'update' | 'delete')[] = [
            'create',
            'list',
            'get',
            'update',
            'delete',
          ];
          for (const op of ops) {
            validate(
              new TestBuilder(model, name, op),
              getFile(`tests/integration/api/${kebabName}/${op}.test.ts`),
              `${entityName}Test ${op}`,
            );
          }
        }
      }
    }

    // Virtual Resources
    const virtualModels: ModelDef[] = [];
    for (const [entityName, routes] of Object.entries(customRoutes)) {
      if (processedModels.has(entityName)) continue;

      const kebabEntity = entityName
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
      const isRoot = entityName === 'Root';

      const virtualModel: ModelDef = {
        name: entityName,
        api: true,
        fields: {},
      };
      virtualModels.push(virtualModel);

      // API Routes
      for (const route of routes) {
        const routePath = route.path.startsWith('/') ? route.path.slice(1) : route.path;
        const fileName = routePath === '' ? 'index' : routePath;

        let apiPathResult: string;
        if (isRoot) {
          apiPathResult = `src/pages/api/${fileName}.ts`;
        } else {
          apiPathResult = `src/pages/api/${kebabEntity}/${fileName}.ts`;
        }

        validate(
          new ApiBuilder(virtualModel, [...models, ...virtualModels], name, 'custom', [route]),
          getFile(apiPathResult),
          `${entityName}API ${fileName}`,
        );

        // Action
        const actionName = `${route.method.charAt(0).toUpperCase() + route.method.slice(1)}${entityName}Action`;
        const kebabMethod = route.method.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        const actionPath = `src/actions/${kebabMethod}-${kebabEntity}.ts`;
        validate(
          new ActionBuilder(actionName, route.input || 'any', route.output || 'any'),
          getFile(actionPath),
          `${entityName}Action`,
        );
      }

      // SDK
      const sdkPath = isRoot ? `src/sdk/root-sdk.ts` : `src/sdk/${kebabEntity}-sdk.ts`;
      validate(new SdkBuilder(virtualModel, routes), getFile(sdkPath), `${entityName}SDK`);
    }

    // Global Files
    validate(
      new SdkIndexBuilder([...models, ...virtualModels], name),
      getFile('src/sdk/index.ts'),
      'SDK Index',
    );
    validate(new FactoryBuilder(models), getFile('tests/integration/factory.ts'), 'Data Factory');
    validate(new ActorBuilder(models), getFile('tests/integration/actors.ts'), 'Actors');
    validate(new ActorTypeBuilder(models), getFile('src/types.d.ts'), 'Actor Types');
    validate(new InitBuilder('server'), getFile('src/server-init.ts'), 'Server Init');

    return issues;
  } catch (error: unknown) {
    report(`Audit threw exception: ${error instanceof Error ? error.message : String(error)}`);
    return issues;
  }
}
