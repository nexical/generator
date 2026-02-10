import { ModuleGenerator } from './module-generator.js';
import { ModelParser } from './model-parser.js';
import { logger } from '@nexical/cli-core';
import { ServiceBuilder } from './builders/service-builder.js';
import { ApiBuilder } from './builders/api-builder.js';
import { SdkBuilder } from './builders/sdk-builder.js';
import { SdkIndexBuilder } from './builders/sdk-index-builder.js';
import { InitBuilder } from './builders/init-builder.js';
import { TestBuilder } from './builders/test-builder.js';
import { ActionBuilder } from './builders/action-builder.js';
import { TypeBuilder } from './builders/type-builder.js';
import { FactoryBuilder } from './builders/factory-builder.js';
import { ActorBuilder } from './builders/actor-builder.js';
import { ActorTypeBuilder } from './builders/actor-type-builder.js';
import { MiddlewareBuilder } from './builders/middleware-builder.js';
import { EmailBuilder } from './builders/email-builder.js';
import { AgentBuilder } from './builders/agent-builder.js';
import { HookBuilder } from './builders/hook-builder.js';
import { type CustomRoute, type ModelDef, type ModuleConfig } from './types.js';
import { toKebabCase } from '../utils/string.js';
import path from 'node:path';
import fs from 'node:fs';
import { parse } from 'yaml';
import { Reconciler } from './reconciler.js';
import { type AccessConfig, type FileDefinition } from './types.js';

export class ApiModuleGenerator extends ModuleGenerator {
  async run(): Promise<void> {
    const modelsYamlPath = path.join(this.modulePath, 'models.yaml');
    const apiYamlPath = path.join(this.modulePath, 'api.yaml');

    const { models, enums, config } = ModelParser.parse(modelsYamlPath);
    console.info(`[ApiModuleGenerator] Models found: ${models.length}`);

    if (models.length === 0) {
      if (this.command) {
        this.command.info('No models found in models.yaml. Skipping generation.');
      } else {
        logger.info('No models found in models.yaml. Skipping generation.');
      }
      return;
    }

    const customRoutes: Record<string, CustomRoute[]> = fs.existsSync(apiYamlPath)
      ? parse(fs.readFileSync(apiYamlPath, 'utf-8'))
      : {};

    // 1. Types
    const typesFile = this.getOrCreateFile('src/sdk/types.ts');
    new TypeBuilder(models, enums).ensure(typesFile);

    const processedModels = new Set(models.map((m) => m.name));

    // 2. Services, API Pages, SDK
    for (const model of models) {
      // Skip if explicitly disabled
      if (!model.db && !model.api) continue;
      const name = model.name;
      const kebabName = toKebabCase(name);

      // Services
      if (model.db && !model.extended) {
        const serviceFile = this.getOrCreateFile(`src/services/${kebabName}-service.ts`);
        new ServiceBuilder(model).ensure(serviceFile);
      }

      // APIs
      if (model.api && !model.extended) {
        if (model.db) {
          const apiColFile = this.getOrCreateFile(`src/pages/api/${kebabName}/index.ts`);
          new ApiBuilder(model, models, this.moduleName, 'collection').ensure(apiColFile);

          const apiIndFile = this.getOrCreateFile(`src/pages/api/${kebabName}/[id].ts`);
          new ApiBuilder(model, models, this.moduleName, 'individual').ensure(apiIndFile);
        }

        // Custom Routes
        const modelRoutes = customRoutes[name] || [];
        const groupedRoutes: Record<string, CustomRoute[]> = {};
        for (const route of modelRoutes) {
          // Robust normalization of Verb
          const validVerbs = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
          if (!route.verb && route.method && validVerbs.includes(route.method.toUpperCase())) {
            route.verb = route.method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
          }
          if (!route.verb) route.verb = 'POST';

          const routePath = route.path.startsWith('/') ? route.path.slice(1) : route.path;
          if (!groupedRoutes[routePath]) groupedRoutes[routePath] = [];
          groupedRoutes[routePath].push(route);
        }

        for (const [routePath, routes] of Object.entries(groupedRoutes)) {
          const apiFile = this.getOrCreateFile(`src/pages/api/${kebabName}/${routePath}.ts`);
          new ApiBuilder(model, models, this.moduleName, 'custom', routes).ensure(apiFile);

          for (const route of routes) {
            // Validation: Strict Schema Enforcement
            if (!route.input) {
              throw new Error(
                `[Strict Schema] Route '${route.verb} ${route.path}' in model '${name}' is missing 'input'. Use 'input: none' if no input is required.`,
              );
            }
            if (!route.output) {
              throw new Error(
                `[Strict Schema] Route '${route.verb} ${route.path}' in model '${name}' is missing 'output'. Use 'output: none' if no output is returned.`,
              );
            }

            // Action Stub
            const kebabMethod = route.method.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
            const actionBase =
              route.action ||
              (kebabMethod.includes(kebabName) ? kebabMethod : `${kebabMethod}-${kebabName}`);

            const actionPath = `src/actions/${actionBase}.ts`;
            const actionFile = this.getOrCreateFile(actionPath);

            const methodPascal = route.method.charAt(0).toUpperCase() + route.method.slice(1);
            const actionName = route.action
              ? route.action
                  .split('-')
                  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                  .join('') + 'Action'
              : (methodPascal.includes(name) ? methodPascal : `${methodPascal}${name}`) + 'Action';

            // Support "none" keyword mapped to "void"
            const inputType = route.input === 'none' ? 'void' : route.input;
            const outputType = route.output === 'none' ? 'void' : route.output;

            new ActionBuilder(actionName, inputType, outputType).ensure(actionFile);
          }
        }

        // SDK
        if (!model.extended) {
          const sdkFile = this.getOrCreateFile(`src/sdk/${kebabName}-sdk.ts`);
          new SdkBuilder(model, modelRoutes).ensure(sdkFile);
        }

        // Tests
        if (model.db && !model.extended) {
          const ops: ('create' | 'list' | 'get' | 'update' | 'delete')[] = [
            'create',
            'list',
            'get',
            'update',
            'delete',
          ];
          for (const op of ops) {
            let role = 'member';
            if (model.role) {
              if (typeof model.role === 'string') {
                role = model.role;
              } else {
                const roleMap = model.role as Record<string, string>;
                role = roleMap[op] || 'member';
              }
            }

            // Skip if role is explicit 'none'
            if (role === 'none') continue;

            const testFile = this.getOrCreateFile(
              `tests/integration/api/generated/${kebabName}/${op}.test.ts`,
            );
            new TestBuilder(model, this.moduleName, op, config.test?.roles || {}).ensure(testFile);
          }
        }
      }
    }

    // 3. Virtual Resources
    const virtualModels: ModelDef[] = [];
    for (const [entityName, routes] of Object.entries(customRoutes)) {
      logger.debug(
        `Checking virtual model: ${entityName} Processed: ${processedModels.has(entityName)}`,
      );
      if (processedModels.has(entityName)) continue;

      const kebabEntity = toKebabCase(entityName);
      const isRoot = entityName === 'Root';

      const virtualModel: ModelDef = {
        name: entityName,
        api: true,
        db: false,
        fields: {},
      };
      virtualModels.push(virtualModel);

      // API Routes
      const groupedVirtualRoutes: Record<string, CustomRoute[]> = {};
      for (const route of routes) {
        // Robust normalization of Verb
        if (
          !route.verb &&
          ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(route.method?.toUpperCase())
        ) {
          route.verb = route.method.toUpperCase() as CustomRoute['verb'];
        }
        if (!route.verb) route.verb = 'POST';

        const routePath = route.path.startsWith('/') ? route.path.slice(1) : route.path;
        const fileName = routePath === '' ? 'index' : routePath;
        if (!groupedVirtualRoutes[fileName]) groupedVirtualRoutes[fileName] = [];
        groupedVirtualRoutes[fileName].push(route);
      }

      for (const [fileName, routes] of Object.entries(groupedVirtualRoutes)) {
        let apiPath: string;
        if (isRoot) {
          apiPath = `src/pages/api/${fileName}.ts`;
        } else {
          apiPath = `src/pages/api/${kebabEntity}/${fileName}.ts`;
        }

        const apiFile = this.getOrCreateFile(apiPath);
        new ApiBuilder(
          virtualModel,
          [...models, ...virtualModels],
          this.moduleName,
          'custom',
          routes,
        ).ensure(apiFile);

        for (const route of routes) {
          // Validation: Strict Schema Enforcement
          if (!route.input) {
            throw new Error(
              `[Strict Schema] Route '${route.verb} ${route.path}' in virtual model '${entityName}' is missing 'input'. Use 'input: none' if no input is required.`,
            );
          }
          if (!route.output) {
            throw new Error(
              `[Strict Schema] Route '${route.verb} ${route.path}' in virtual model '${entityName}' is missing 'output'. Use 'output: none' if no output is returned.`,
            );
          }

          // Action
          const kebabMethod = route.method.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          const actionBase =
            route.action ||
            (kebabMethod.includes(kebabEntity) ? kebabMethod : `${kebabMethod}-${kebabEntity}`);

          const actionPath = `src/actions/${actionBase}.ts`;
          const actionFile = this.getOrCreateFile(actionPath);

          const methodPascal = route.method.charAt(0).toUpperCase() + route.method.slice(1);
          const actionName = route.action
            ? route.action
                .split('-')
                .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                .join('') + 'Action'
            : (methodPascal.includes(entityName) ? methodPascal : `${methodPascal}${entityName}`) +
              'Action';

          // Support "none" keyword mapped to "void"
          const inputType = route.input === 'none' ? 'void' : route.input;
          const outputType = route.output === 'none' ? 'void' : route.output;

          new ActionBuilder(actionName, inputType, outputType).ensure(actionFile);
        }
      }

      // SDK
      const sdkPath = isRoot ? `src/sdk/root-sdk.ts` : `src/sdk/${kebabEntity}-sdk.ts`;
      const sdkFile = this.getOrCreateFile(sdkPath);
      new SdkBuilder(virtualModel, routes).ensure(sdkFile);
    }

    // 4. SDK Index
    const sdkIndexFile = this.getOrCreateFile('src/sdk/index.ts');
    new SdkIndexBuilder([...models, ...virtualModels], this.moduleName).ensure(sdkIndexFile);

    // 4. Test Utilities (Factories/Actors)
    const factoryFile = this.getOrCreateFile('tests/integration/factory.ts');
    new FactoryBuilder(models).ensure(factoryFile);

    const actorFile = this.getOrCreateFile('tests/integration/actors.ts');
    new ActorBuilder(models).ensure(actorFile);

    const actorTypeFile = this.getOrCreateFile('src/types.d.ts');
    new ActorTypeBuilder(models).ensure(actorTypeFile);

    // 6. Init File (Server)
    const serverInitFile = this.getOrCreateFile('src/server-init.ts');
    new InitBuilder('server').ensure(serverInitFile);

    // 7. Communications & Distributed Services
    const allCustomRoutes = Object.values(customRoutes).flat();
    await new EmailBuilder(this.moduleName, config as unknown as ModuleConfig).build(
      this.project,
      undefined,
    );
    await new AgentBuilder(this.moduleName, config as unknown as ModuleConfig).build(
      this.project,
      undefined,
    );
    await new HookBuilder(this.moduleName, config as unknown as ModuleConfig).build(
      this.project,
      undefined,
    );

    // 8. Middleware
    const middlewareFile = this.getOrCreateFile('src/middleware.ts');
    const modelRoutes: CustomRoute[] = models.flatMap((m) => [
      {
        path: `/api/${m.name.toLowerCase()}`,
        verb: 'POST',
        role: (m.role as string) || 'member',
        method: 'create',
        input: 'any',
        output: 'any',
      },
      {
        path: `/api/${m.name.toLowerCase()}`,
        verb: 'GET',
        role: (m.role as string) || 'member',
        method: 'list',
        input: 'any',
        output: 'any',
      },
      {
        path: `/api/${m.name.toLowerCase()}/[id]`,
        verb: 'GET',
        role: (m.role as string) || 'member',
        method: 'get',
        input: 'any',
        output: 'any',
      },
    ]);
    new MiddlewareBuilder(models, [...allCustomRoutes, ...modelRoutes]).ensure(middlewareFile);

    // 9. Access Control (Roles & Permissions)
    const accessYamlPath = path.join(this.modulePath, 'access.yaml');
    if (fs.existsSync(accessYamlPath)) {
      logger.info(`[ModuleGenerator] Found access.yaml. Generating Security Layer...`);
      const parsedAccess = parse(fs.readFileSync(accessYamlPath, 'utf-8'));
      const accessConfig = (parsedAccess.config || parsedAccess) as AccessConfig;

      // 9a. Generate Role Files
      if (accessConfig.roles) {
        // Ensure BaseRole exists
        const baseRoleFile = this.getOrCreateFile('src/roles/base-role.ts');
        Reconciler.reconcile(baseRoleFile, {
          header: '// GENERATED CODE - DO NOT MODIFY',
          classes: [
            {
              name: 'BaseRole',
              isExported: true,
              isAbstract: true,
              properties: [],
              methods: [
                {
                  name: 'check',
                  isAsync: true,
                  parameters: [
                    { name: 'context', type: 'unknown' }, // using unknown for now or Import types
                    { name: 'permission', type: 'string' },
                  ],
                  returnType: 'Promise<boolean>',
                  statements: [
                    {
                      kind: 'return',
                      expression: 'true', // Default or valid logic
                    },
                  ],
                },
              ],
            },
          ],
        });

        for (const [roleName, roleDef] of Object.entries(accessConfig.roles)) {
          logger.info(`[ModuleGenerator] Generating Role: ${roleName}`);
          const pascalName = roleName.charAt(0).toUpperCase() + roleName.slice(1).toLowerCase();
          const roleFile = this.getOrCreateFile(`src/roles/${pascalName.toLowerCase()}.ts`);

          const fileDef: FileDefinition = {
            header: '// GENERATED CODE - DO NOT MODIFY',
            role: {
              name: roleName,
              definition: roleDef,
            },
          };
          Reconciler.reconcile(roleFile, fileDef);
        }
      }

      // 9b. Generate Permission Registry
      if (accessConfig.permissions) {
        logger.info(`[ModuleGenerator] Generating Permission Registry`);

        const rolePermissions: Record<string, string[]> = {};
        if (accessConfig.roles) {
          for (const [role, def] of Object.entries(accessConfig.roles)) {
            rolePermissions[role] = def.permissions || [];
          }
        }

        const permFile = this.getOrCreateFile('src/permissions.ts');
        Reconciler.reconcile(permFile, {
          header: '// GENERATED CODE - DO NOT MODIFY',
          permissions: accessConfig.permissions,
          rolePermissions,
        });
      }
    }

    // 5. Cleanup
    this.cleanup('src/actions', /\.ts$/);
    this.cleanup('src/services', /\.ts$/);
    this.cleanup('src/pages/api', /\.ts$/);
    this.cleanup('src/sdk', /\.ts$/);
    this.cleanup('tests/integration/api/generated', /\.test\.ts$/);

    // Remove old duplicated actor-types if they exist
    const oldActorTypes = path.join(this.modulePath, 'tests/integration/actor-types.ts');
    if (fs.existsSync(oldActorTypes)) fs.unlinkSync(oldActorTypes);

    await this.saveAll();
  }
}
