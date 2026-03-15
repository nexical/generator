import { ModuleGenerator } from './module-generator.js';
import { ModelParser } from './model-parser.js';
import { logger } from '@nexical/cli-core';
import { ServiceBuilder } from './builders/service-builder.js';
import { ApiBuilder } from './builders/api-builder.js';
import { SdkBuilder } from './builders/sdk-builder.js';
import { SdkIndexBuilder } from './builders/sdk-index-builder.js';
import { InitBuilder } from './builders/init-builder.js';
import { IntegrationTestBuilder } from './builders/integration-test-builder.js';
import { ActionBuilder } from './builders/action-builder.js';
import { ServiceIntegrationTestBuilder } from './builders/service-integration-test-builder.js';
import { TypeBuilder } from './builders/type-builder.js';
import { FactoryBuilder } from './builders/factory-builder.js';
import { ActorBuilder } from './builders/actor-builder.js';
import { ActorTypeBuilder } from './builders/actor-type-builder.js';
import { MiddlewareBuilder } from './builders/middleware-builder.js';
import { EmailBuilder } from './builders/email-builder.js';
import { AgentBuilder } from './builders/agent-builder.js';
import { HookBuilder } from './builders/hook-builder.js';
import { RoleBuilder } from './builders/role-builder.js';
import { ApiUnitTestBuilder } from './builders/test/api-unit-test-builder.js';
import { ActionUnitTestBuilder } from './builders/test/action-unit-test-builder.js';
import { ServiceUnitTestBuilder } from './builders/test/service-unit-test-builder.js';
import { SdkUnitTestBuilder } from './builders/test/sdk-unit-test-builder.js';
import { RoleUnitTestBuilder } from './builders/test/role-unit-test-builder.js';
import { HookUnitTestBuilder } from './builders/test/hook-unit-test-builder.js';
import { AgentUnitTestBuilder } from './builders/test/agent-unit-test-builder.js';
import { ConfigUnitTestBuilder } from './builders/test/config-unit-test-builder.js';
import { MiddlewareUnitTestBuilder } from './builders/test/middleware-unit-test-builder.js';
import { PermissionUnitTestBuilder } from './builders/test/permission-unit-test-builder.js';
import { type CustomRoute, type ModelDef, type ModuleConfig, type AccessConfig } from './types.js';
import { toKebabCase, toPascalCase } from '../utils/string.js';
import path from 'node:path';
import fs from 'node:fs';
import { parse } from 'yaml';
import { Reconciler } from './reconciler.js';
import { TemplateLoader } from '../utils/template-loader.js';

export class ApiModuleGenerator extends ModuleGenerator {
  async run(): Promise<void> {
    const modelsYamlPath = path.join(this.modulePath, 'models.yaml');
    const apiYamlPath = path.join(this.modulePath, 'api.yaml');

    const { models, enums, config } = ModelParser.parse(modelsYamlPath);
    console.info(`[ApiModuleGenerator] Models found: ${models.length}`);

    const apiContent = fs.existsSync(apiYamlPath) ? fs.readFileSync(apiYamlPath, 'utf-8') : '';
    const customRoutes: Record<string, CustomRoute[]> = apiContent.trim()
      ? parse(apiContent) || {}
      : {};

    if (models.length === 0 && Object.keys(customRoutes).length === 0) {
      if (this.command) {
        this.command.info('No models or custom routes found. Skipping generation.');
      } else {
        logger.info('No models or custom routes found. Skipping generation.');
      }
      return;
    }

    // 1. Types
    const typesFile = this.getOrCreateFile('src/sdk/types.ts');
    new TypeBuilder(models, enums).ensure(typesFile);

    const processedModels = new Set(models.map((m) => m.name));

    // 0. Pre-collect all services for mocking in actions
    const allServices: { name: string; path: string }[] = [];
    for (const model of models) {
      if (model.db && !model.extended) {
        const kebabName = toKebabCase(model.name);
        allServices.push({
          name: `${model.name}Service`,
          path: `../../../src/services/${kebabName}-service`,
        });
      }
    }

    // 2. Services, API Pages, SDK
    for (const model of models) {
      if (!model.db && !model.api) continue;
      const name = model.name;
      const kebabName = toKebabCase(name);

      // Services
      if (model.db && !model.extended) {
        logger.info(`[ApiModuleGenerator] Generating Service & Tests for: ${name}`);
        const serviceFile = this.getOrCreateFile(`src/services/${kebabName}-service.ts`);
        new ServiceBuilder(model).ensure(serviceFile);

        const serviceUnitTestFile = this.getOrCreateFile(
          `tests/unit/services/${kebabName}-service.test.ts`,
        );
        serviceUnitTestFile.replaceWithText(''); // Prevent duplication
        const serviceRelPath = `src/services/${kebabName}-service.ts`;
        const discoveredMethods = this.discoverMethods(serviceRelPath);
        logger.info(
          `[ApiModuleGenerator] Discovered ${Object.keys(discoveredMethods).length} methods for ${name}Service`,
        );
        new ServiceUnitTestBuilder(
          `${name}Service`,
          name,
          `../../../src/services/${kebabName}-service`,
          discoveredMethods,
          models.map((m) => m.name),
          models,
        ).ensure(serviceUnitTestFile);
      }

      // APIs
      if (model.api && !model.extended) {
        if (model.db) {
          const apiColFile = this.getOrCreateFile(`src/pages/api/${kebabName}/index.ts`);
          new ApiBuilder(model, models, this.moduleName, 'collection').ensure(apiColFile);

          const apiColUnitTestFile = this.getOrCreateFile(
            `tests/unit/pages/api/${kebabName}/index.test.ts`,
          );
          new ApiUnitTestBuilder(
            this.moduleName,
            name,
            `../../../../../src/pages/api/${kebabName}/index`,
            [{ method: 'GET' }],
            `${name}Service`,
            `../../../../../src/services/${kebabName}-service`,
          ).ensure(apiColUnitTestFile);

          const apiIndFile = this.getOrCreateFile(`src/pages/api/${kebabName}/[id].ts`);
          new ApiBuilder(model, models, this.moduleName, 'individual').ensure(apiIndFile);

          const apiIndUnitTestFile = this.getOrCreateFile(
            `tests/unit/pages/api/${kebabName}/[id].test.ts`,
          );
          new ApiUnitTestBuilder(
            this.moduleName,
            name,
            `../../../../../src/pages/api/${kebabName}/[id]`,
            [{ method: 'GET' }],
            `${name}Service`,
            `../../../../../src/services/${kebabName}-service`,
          ).ensure(apiIndUnitTestFile);
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

          const rawPath = route.path.startsWith('/') ? route.path.slice(1) : route.path;
          const routePath = rawPath || 'index';
          if (!groupedRoutes[routePath]) groupedRoutes[routePath] = [];
          groupedRoutes[routePath].push(route);
        }

        for (const [routePath, routes] of Object.entries(groupedRoutes)) {
          const apiFile = this.getOrCreateFile(`src/pages/api/${kebabName}/${routePath}.ts`);
          new ApiBuilder(model, models, this.moduleName, 'custom', routes).ensure(apiFile);

          // API Unit Tests (Grouped)
          const apiUnitTestFile = this.getOrCreateFile(
            `tests/unit/pages/api/${kebabName}/${routePath}.test.ts`,
          );
          const levels = routePath.split('/').length + 4;
          const prefix = '../'.repeat(levels);

          const unitTestRoutes = routes.map((route) => {
            const kebabMethod = route.method.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
            const actionBase =
              route.action ||
              (kebabMethod.includes(kebabName) ? kebabMethod : `${kebabMethod}-${kebabName}`);
            const methodPascal = route.method.charAt(0).toUpperCase() + route.method.slice(1);
            const actionName = route.action
              ? route.action
                  .split('-')
                  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                  .join('') + 'Action'
              : (methodPascal.includes(name) ? methodPascal : `${methodPascal}${name}`) + 'Action';

            return {
              method: route.verb,
              actionName,
              actionPath: `${prefix}src/actions/${actionBase}`,
            };
          });

          new ApiUnitTestBuilder(
            this.moduleName,
            name,
            `${prefix}src/pages/api/${kebabName}/${routePath}`,
            unitTestRoutes,
          ).ensure(apiUnitTestFile);

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

            const serviceTestPath = `tests/integration/services/${actionBase}.test.ts`;
            const serviceTestFile = this.getOrCreateFile(serviceTestPath);
            new ServiceIntegrationTestBuilder(actionBase, actionName, inputType, outputType).ensure(
              serviceTestFile,
            );

            const actionUnitTestFile = this.getOrCreateFile(
              `tests/unit/actions/${actionBase}.test.ts`,
            );
            new ActionUnitTestBuilder(
              actionName,
              `../../../src/actions/${actionBase}`,
              actionFile,
              [],
              name,
            ).ensure(actionUnitTestFile);
          }
        }

        // SDK
        if (!model.extended) {
          const sdkFile = this.getOrCreateFile(`src/sdk/${kebabName}-sdk.ts`);
          new SdkBuilder(model, modelRoutes).ensure(sdkFile);

          const sdkUnitTestFile = this.getOrCreateFile(`tests/unit/sdk/${kebabName}-sdk.test.ts`);
          sdkUnitTestFile.replaceWithText(''); // Prevent duplication

          const sdkRelPath = `src/sdk/${kebabName}-sdk.ts`;
          const discoveredMethods = this.discoverMethods(sdkRelPath);

          new SdkUnitTestBuilder(
            `${name}SDK`,
            `../../../src/sdk/${kebabName}-sdk`,
            name,
            modelRoutes,
            model.db,
            discoveredMethods,
          ).ensure(sdkUnitTestFile);
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
            new IntegrationTestBuilder(model, this.moduleName, op, config.test?.roles || {}).ensure(
              testFile,
            );
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

        // API Unit Tests (Grouped)
        const apiUnitTestFile = this.getOrCreateFile(
          isRoot
            ? `tests/unit/pages/api/${fileName}.test.ts`
            : `tests/unit/pages/api/${kebabEntity}/${fileName}.test.ts`,
        );

        const levels = (isRoot ? 0 : 1) + fileName.split('/').length + 3;
        const prefix = '../'.repeat(levels);

        const unitTestRoutes = routes.map((route) => {
          const kebabMethod = route.method.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          const actionBase =
            route.action ||
            (kebabMethod.includes(kebabEntity) ? kebabMethod : `${kebabMethod}-${kebabEntity}`);
          const methodPascal = route.method.charAt(0).toUpperCase() + route.method.slice(1);
          const actionName = route.action
            ? route.action
                .split('-')
                .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                .join('') + 'Action'
            : (methodPascal.includes(entityName) ? methodPascal : `${methodPascal}${entityName}`) +
              'Action';

          return {
            method: route.verb,
            actionName,
            actionPath: `${prefix}src/actions/${actionBase}`,
          };
        });

        new ApiUnitTestBuilder(
          this.moduleName,
          entityName,
          isRoot
            ? `${prefix}src/pages/api/${fileName}`
            : `${prefix}src/pages/api/${kebabEntity}/${fileName}`,
          unitTestRoutes,
        ).ensure(apiUnitTestFile);

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

          const serviceTestPath = `tests/integration/services/${actionBase}.test.ts`;
          const serviceTestFile = this.getOrCreateFile(serviceTestPath);
          new ServiceIntegrationTestBuilder(actionBase, actionName, inputType, outputType).ensure(
            serviceTestFile,
          );

          const actionUnitTestFile = this.getOrCreateFile(
            `tests/unit/actions/${actionBase}.test.ts`,
          );
          actionUnitTestFile.replaceWithText(''); // Prevent duplication
          new ActionUnitTestBuilder(
            actionName,
            `../../../src/actions/${actionBase}`,
            actionFile,
            [],
            entityName,
          ).ensure(actionUnitTestFile);
        }
      }

      // SDK
      const sdkPath = isRoot ? `src/sdk/root-sdk.ts` : `src/sdk/${kebabEntity}-sdk.ts`;
      const sdkFile = this.getOrCreateFile(sdkPath);
      new SdkBuilder(virtualModel, routes).ensure(sdkFile);

      const sdkUnitTestPath = isRoot
        ? `tests/unit/sdk/root-sdk.test.ts`
        : `tests/unit/sdk/${kebabEntity}-sdk.test.ts`;
      const sdkUnitTestFile = this.getOrCreateFile(sdkUnitTestPath);
      sdkUnitTestFile.replaceWithText(''); // Prevent duplication

      const discoveredMethods = this.discoverMethods(sdkPath);

      new SdkUnitTestBuilder(
        isRoot ? 'RootSDK' : `${entityName}SDK`,
        isRoot ? `../../../src/sdk/root-sdk` : `../../../src/sdk/${kebabEntity}-sdk`,
        entityName,
        routes,
        false,
        discoveredMethods,
      ).ensure(sdkUnitTestFile);
    }

    // 4. Security Config (Roles & Permissions)
    const accessYamlPath = path.join(this.modulePath, 'access.yaml');
    let roles: string[] = [];
    let accessConfig: AccessConfig | undefined;

    if (fs.existsSync(accessYamlPath)) {
      const content = fs.readFileSync(accessYamlPath, 'utf-8');
      if (content.trim()) {
        const parsedAccess = parse(content);
        if (parsedAccess) {
          accessConfig = (parsedAccess.config || parsedAccess) as AccessConfig;
          if (accessConfig?.roles) {
            roles = Object.keys(accessConfig.roles);
          }
        }
      }
    }

    // 4. SDK Index
    const sdkIndexFile = this.getOrCreateFile('src/sdk/index.ts');
    new SdkIndexBuilder([...models, ...virtualModels], this.moduleName, roles).ensure(sdkIndexFile);

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
        input: 'unknown',
        output: 'unknown',
      },
      {
        path: `/api/${m.name.toLowerCase()}`,
        verb: 'GET',
        role: (m.role as string) || 'member',
        method: 'list',
        input: 'unknown',
        output: 'unknown',
      },
      {
        path: `/api/${m.name.toLowerCase()}/[id]`,
        verb: 'GET',
        role: (m.role as string) || 'member',
        method: 'get',
        input: 'unknown',
        output: 'unknown',
      },
    ]);
    new MiddlewareBuilder(models, [...allCustomRoutes, ...modelRoutes]).ensure(middlewareFile);

    const middlewareUnitTestFile = this.getOrCreateFile('tests/unit/middleware.test.ts');
    middlewareUnitTestFile.replaceWithText(''); // Prevent duplication
    new MiddlewareUnitTestBuilder(this.moduleName, '../../src/middleware', models).ensure(
      middlewareUnitTestFile,
    );

    // 9. Access Control (Roles & Permissions)
    if (fs.existsSync(accessYamlPath)) {
      logger.info(`[ModuleGenerator] Found access.yaml. Generating Security Layer...`);
      // Use pre-parsed accessConfig
      if (!accessConfig) {
        const content = fs.readFileSync(accessYamlPath, 'utf-8');
        if (content.trim()) {
          const parsedAccess = parse(content);
          if (parsedAccess) {
            accessConfig = (parsedAccess.config || parsedAccess) as AccessConfig;
          }
        }
      }

      if (accessConfig) {
        // 9a. Generate Role Files
        if (accessConfig.roles) {
          // Ensure BaseRole exists
          const baseRoleFile = this.getOrCreateFile(path.join('src', 'roles', 'base-role.ts'));
          baseRoleFile.replaceWithText(this.debugBaseRoleText(accessConfig));

          for (const [roleName, roleDef] of Object.entries(accessConfig.roles)) {
            logger.info(`[ModuleGenerator] Generating Role: ${roleName}`);
            const roleFile = this.getOrCreateFile(`src/roles/${roleName.toLowerCase()}.ts`);

            // Extract compatible roles from config.test.roles
            const compatibleRoles: string[] = [];
            const testRoles = config?.test?.roles;
            if (testRoles) {
              for (const [testRole, mapping] of Object.entries(testRoles)) {
                if (testRole === roleName && mapping?.role) {
                  compatibleRoles.push(String(mapping.role));
                }
              }
            }

            new RoleBuilder({ name: roleName, definition: roleDef, compatibleRoles }).ensure(
              roleFile,
            );

            const roleUnitTestFile = this.getOrCreateFile(
              `tests/unit/roles/${roleName.toLowerCase()}.test.ts`,
            );
            roleUnitTestFile.replaceWithText(''); // Prevent duplication
            const pascalName = toPascalCase(roleName);
            const className = `${pascalName}Role`;
            new RoleUnitTestBuilder(
              className,
              roleName,
              `../../../src/roles/${roleName.toLowerCase()}`,
            ).ensure(roleUnitTestFile);
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

          const permUnitTestFile = this.getOrCreateFile('tests/unit/permissions.test.ts');
          permUnitTestFile.replaceWithText(''); // Prevent duplication
          new PermissionUnitTestBuilder(this.moduleName).ensure(permUnitTestFile);
        }
      }
    }

    // 5. Cleanup
    this.cleanup('src/actions', /\.ts$/);
    this.cleanup('src/services', /\.ts$/);
    this.cleanup('src/pages/api', /\.ts$/);
    this.cleanup('src/sdk', /\.ts$/);
    this.cleanup('tests/integration/api/generated', /\.test\.ts$/);
    this.cleanup('tests/unit/services', /\.test\.ts$/);
    this.cleanup('tests/unit/actions', /\.test\.ts$/);
    this.cleanup('tests/unit/sdk', /\.test\.ts$/);
    this.cleanup('tests/unit/pages/api', /\.test\.ts$/);
    this.cleanup('tests/unit/roles', /\.test\.ts$/);
    this.cleanup('tests/unit/hooks', /\.test\.ts$/);
    this.cleanup('tests/unit', /^permissions\.test\.ts$/);

    // Remove old duplicated actor-types if they exist
    const oldActorTypes = path.join(this.modulePath, 'tests/integration/actor-types.ts');
    if (fs.existsSync(oldActorTypes)) fs.unlinkSync(oldActorTypes);

    // 11. Coverage Sweeper (Identify uncovered hooks, agents, config)
    this.runCoverageSweeper();

    // 10. Run Custom Builders
    await this.runCustomBuilders({ models, customRoutes, accessConfig });

    await this.saveAll();

    logger.info(`[ModuleGenerator] API Generation for ${this.moduleName} complete.`);
  }

  private discoverMethods(filePath: string): Record<string, number> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.modulePath, filePath);

    // Check in-memory project first
    const sourceFile = this.project.getSourceFile(fullPath);
    let content = '';
    if (sourceFile) {
      content = sourceFile.getFullText();
    } else if (fs.existsSync(fullPath)) {
      content = fs.readFileSync(fullPath, 'utf-8');
    }

    const defaultMethods = {
      list: 1,
      get: 1,
      create: 1,
      update: 2,
      delete: 1,
      upsert: 1,
      count: 1,
    };

    if (!content) return defaultMethods;

    // Find all methods (static or instance) that look like service methods
    // Regex matches: async methodName(params)
    const methodRegex =
      /(?:public|private|protected)?\s*(?:static\s+)?async\s+(\w+)\s*\(([^)]*)\)/g;
    const methods: Record<string, number> = {};
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      const params = match[2].trim();

      if (!['init', 'run', 'constructor'].includes(methodName)) {
        // Count parameters by counting commas and adding 1 (if not empty)
        const paramCount = params ? params.split(',').length : 0;
        methods[methodName] = paramCount;
      }
    }

    return Object.keys(methods).length > 0 ? methods : defaultMethods;
  }

  public debugBaseRoleText(accessConfig: AccessConfig): string {
    return TemplateLoader.load('roles/base-role.tsf', {
      accessConfig: JSON.stringify(accessConfig),
    }).raw;
  }

  private runCoverageSweeper() {
    this.sweepDirectory('src/hooks', 'tests/unit/hooks', (name, relPath, testFile) => {
      if (testFile.getText() === '' || testFile.getText().includes('GENERATED CODE')) {
        testFile.replaceWithText('');
        new HookUnitTestBuilder(name, relPath).ensure(testFile);
      }
    });
    this.sweepDirectory('src/agent', 'tests/unit/agent', (name, relPath, testFile) => {
      if (testFile.getText() === '' || testFile.getText().includes('GENERATED CODE')) {
        testFile.replaceWithText('');
        const className = toPascalCase(name);
        new AgentUnitTestBuilder(className, relPath).ensure(testFile);
      }
    });
    this.sweepDirectory('src/config', 'tests/unit/config', (name, relPath, testFile) => {
      if (testFile.getText() === '' || testFile.getText().includes('GENERATED CODE')) {
        testFile.replaceWithText('');
        new ConfigUnitTestBuilder(name, relPath).ensure(testFile);
      }
    });
    this.sweepDirectory('src/services', 'tests/unit/services', (name, relPath, testFile) => {
      if (testFile.getText() === '' || testFile.getText().includes('GENERATED CODE')) {
        testFile.replaceWithText('');
        const discoveredMethods = this.discoverMethods(relPath.replace('../../../', '') + '.ts');
        const className = toPascalCase(name);
        const entityName = name.replace(/-service$/, '').replace(/Service$/, '');

        // Find models.yaml in the current module
        const modelsYamlPath = path.join(this.modulePath, 'models.yaml');
        const validModelNames = fs.existsSync(modelsYamlPath)
          ? ModelParser.parse(modelsYamlPath).models.map((m) => m.name)
          : [];

        new ServiceUnitTestBuilder(
          className,
          entityName,
          relPath,
          discoveredMethods,
          validModelNames,
          ModelParser.parse(modelsYamlPath).models,
        ).ensure(testFile);
      }
    });
  }

  private sweepDirectory(
    srcDirRel: string,
    testDirRel: string,
    builder: (name: string, relPath: string, testFile: SourceFile) => void,
  ) {
    const srcDir = path.join(this.modulePath, srcDirRel);
    if (!fs.existsSync(srcDir)) return;

    const files = fs.readdirSync(srcDir);
    for (const file of files) {
      if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
        const fullSrcPath = path.join(srcDir, file);
        const content = fs.readFileSync(fullSrcPath, 'utf-8');

        // Safety: Skip React hooks (misplaced in backend)
        if (content.includes('import { useState') || content.includes("from 'react'")) {
          continue;
        }

        // Safety: Skip hooks without init (only for src/hooks)
        if (srcDirRel === 'src/hooks') {
          if (!content.includes('export const init') && !content.includes('static init()')) {
            continue;
          }
        }

        const name = path.basename(file, '.ts');
        const kebabName = toKebabCase(name);
        const testFileName = `${kebabName}.test.ts`;
        const testFilePath = path.join(testDirRel, testFileName);

        const testFile = this.getOrCreateFile(testFilePath);

        // Relative path from test file to src file
        // tests/unit/hooks/foo.test.ts -> ../../../src/hooks/foo
        const levels = testDirRel.split('/').length;
        const prefix = '../'.repeat(levels);
        const relPath = `${prefix}${srcDirRel}/${name}`;

        builder(name, relPath, testFile);
      }
    }
  }
}
