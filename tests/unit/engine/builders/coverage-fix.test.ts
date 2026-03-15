/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ActionBuilder } from '../../../../src/engine/builders/action-builder.js';
import { ActorBuilder } from '../../../../src/engine/builders/actor-builder.js';
import { ServiceIntegrationTestBuilder } from '../../../../src/engine/builders/service-integration-test-builder.js';
import { ApiModuleGenerator } from '../../../../src/engine/api-module-generator.js';
import { type ModelDef } from '../../../../src/engine/types.js';

describe('Coverage Fix - Generator Builders', () => {
  it('ActorBuilder - should handle model with role field (roleCleanup empty)', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        api: true,
        actor: { strategy: 'login', fields: { identifier: 'email', secret: 'password' } },
        fields: {
          email: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
          role: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
    ];
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('actors.ts', '');
    const builder = new ActorBuilder(models);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    // It should NOT contain the delete statement for role
    expect(text).not.toContain('delete factoryParams.role');
  });

  it('ActionBuilder - should reconcile "data: undefined as any"', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'action.ts',
      `
export class MyAction {
  static async run(input: any, context: any) {
    return { success: true, data: undefined as any };
  }
}
    `,
    );

    const builder = new ActionBuilder('MyAction', 'MyInput', 'MyOutput');
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    // It should replace "data: undefined as any" with "data: {} as unknown as MyOutput"
    expect(text).toContain('data: {} as unknown as MyOutput');
    expect(text).not.toContain('undefined as any');
  });

  it('ActionBuilder - should cover all service branches', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'services.ts',
      `
            export class ServiceAction {
                static async run() {
                    OrchestrationService.do();
                    JobMetricsService.do();
                    AgentService.do();
                    ApiActor.do();
                    z.string();
                    TeamRole.do();
                    HookSystem.do();
                    AuthService.do();
                    bcrypt.hash();
                    db.user.findMany();
                }
            }
        `,
    );

    const builder = new ActionBuilder('ServiceAction', 'void', 'string');
    const schema = (
      builder as unknown as { getSchema(node: unknown): { imports: { moduleSpecifier: string }[] } }
    ).getSchema(sourceFile);

    const imports = schema.imports.map((i) => i.moduleSpecifier);
    expect(imports).toContain('../services/orchestration-service');
    expect(imports).toContain('../services/job-metrics-service');
    expect(imports).toContain('../services/agent-service');
    expect(imports).toContain('@/lib/api/api-docs');
    expect(imports).toContain('zod');
    expect(imports).toContain('@/lib/modules/hooks');
    expect(imports).toContain('../services/auth-service');
    expect(imports).toContain('bcryptjs');
    expect(imports).toContain('@/lib/core/db');
  });

  it('ServiceIntegrationTestBuilder - should cover various input/output types', () => {
    const builder1 = new ServiceIntegrationTestBuilder('test-api', 'DoStuff', 'string', 'void');
    const schema1 = (builder1 as unknown as { getSchema(): { header: string } }).getSchema();
    expect(schema1.header).toContain('INITIAL');

    const builder2 = new ServiceIntegrationTestBuilder('test-api', 'GetMany', 'User[]', 'void');
    const schema2 = (
      builder2 as unknown as { getSchema(): { imports: { namedImports: string[] }[] } }
    ).getSchema();
    expect(schema2.imports.some((i) => i.namedImports.includes('User'))).toBe(true);
  });

  it('ActorBuilder - should cover all strategies and edge cases', () => {
    const models = [
      {
        name: 'User',
        fields: { role: { type: 'String' } },
        actor: { strategy: 'login', fields: { identifier: 'email' } },
      },
      {
        name: 'ApiKey',
        fields: {},
        actor: { strategy: 'api-key', fields: { keyModel: 'Key', ownerField: 'user' } },
      },
      {
        name: 'Session',
        fields: { role: { type: 'String' } },
        actor: {
          strategy: 'bearer',
          prefix: 'Bearer ',
          fields: { tokenModel: 'Token', keyField: 'id' },
        },
      },
    ];
    const builder = new ActorBuilder(models as unknown as ModelDef[]);
    const schema = (
      builder as unknown as { getSchema(): { variables: { name: string }[] } }
    ).getSchema();
    expect(schema.variables[0].name).toBe('actors');

    // Test empty model list
    const emptyBuilder = new ActorBuilder([]);
    const emptySchema = (
      emptyBuilder as unknown as { getSchema(): { variables: { initializer: string }[] } }
    ).getSchema();
    expect(emptySchema.variables[0].initializer).toContain('{');
    expect(emptySchema.variables[0].initializer).toContain('}');
  });

  it('ActionBuilder - should handle complex imports and existing code', () => {
    const builder = new ActionBuilder('ComplexAction', 'Input', 'Output');
    const mockFile = {
      getClass: () => ({
        getMethod: () => ({
          isStatic: () => true,
          getBodyText: () =>
            'OrchestrationService.run(); AuthService.login(); bcrypt.hash(); db.user.find();',
        }),
        getStaticMethod: () => null,
      }),
      getFullText: () =>
        'OrchestrationService; AuthService; bcrypt; db.; TeamRole; ApiActor; z.string(); HookSystem.on();',
      getImportDeclarations: () => [],
    };
    const schema = (
      builder as unknown as { getSchema(node: unknown): { imports: { moduleSpecifier: string }[] } }
    ).getSchema(mockFile as unknown);
    const specifiers = schema.imports.map((i) => i.moduleSpecifier);
    expect(specifiers).toContain('../services/orchestration-service');
    expect(specifiers).toContain('../services/auth-service');
    expect(specifiers).toContain('bcryptjs');
    expect(specifiers).toContain('@/lib/core/db');
  });

  it('ActionBuilder - should handle TeamRole as input and output (not type-only)', () => {
    const builder = new ActionBuilder('RoleAction', 'TeamRole', 'TeamRole');
    const schema = (
      builder as unknown as {
        getSchema(): {
          imports: { moduleSpecifier: string; isTypeOnly: boolean; namedImports: string[] }[];
        };
      }
    ).getSchema();
    const sdkImport = schema.imports.find((i) => i.moduleSpecifier === '../sdk/types');
    expect(sdkImport?.isTypeOnly).toBe(false);
    expect(sdkImport?.namedImports).toContain('TeamRole');
  });

  it('ActorBuilder - should enable crypto for bearer strategy with hash in keyField', () => {
    const models = [
      {
        name: 'Session',
        fields: { role: { type: 'String' } },
        actor: {
          strategy: 'bearer',
          prefix: 'Bearer ',
          fields: { tokenModel: 'Token', keyField: 'hashedToken' },
        },
      },
    ];
    const builder = new ActorBuilder(models as unknown as ModelDef[]);
    const schema = (
      builder as unknown as { getSchema(): { imports: { moduleSpecifier: string }[] } }
    ).getSchema();
    expect(schema.imports.some((i) => i.moduleSpecifier === 'node:crypto')).toBe(true);
  });

  it('ActionBuilder - should cover existing statements from manual node', () => {
    const builder = new ActionBuilder('ManualAction', 'void', 'void');
    const mockNode = {
      getClass: () => ({
        getMethod: () => ({
          isStatic: () => true,
          getBodyText: () => '// manual code',
        }),
        getStaticMethod: () => null,
      }),
      getFullText: () => 'ManualAction',
      getImportDeclarations: () => [],
    };
    const schema = (
      builder as unknown as {
        getSchema(node: unknown): { classes: { methods: { statements: { raw: string }[] }[] }[] };
      }
    ).getSchema(mockNode as unknown);
    expect(schema.classes[0].methods[0].statements[0].raw).toContain('// manual code');
  });

  it('ActionBuilder - should cover ALL service imports', () => {
    const builder = new ActionBuilder('AllServices', 'void', 'void');
    const mockFile = {
      getFullText: () => `
                OrchestrationService.run();
                JobMetricsService.report();
                AgentService.heartbeat();
                ApiActor.name;
                z.string();
                TeamRole.OWNER;
                HookSystem.dispatch();
                AuthService.login();
                bcrypt.hash();
                db.user.find();
                const something = db ;
            `,
      getImportDeclarations: () => [],
    };
    const schema = (
      builder as unknown as { getSchema(node: unknown): { imports: { moduleSpecifier: string }[] } }
    ).getSchema(mockFile as unknown);
    const specifiers = schema.imports.map((i) => i.moduleSpecifier);
    expect(specifiers).toContain('../services/orchestration-service');
    expect(specifiers).toContain('../services/job-metrics-service');
    expect(specifiers).toContain('../services/agent-service');
    expect(specifiers).toContain('@/lib/api/api-docs');
    expect(specifiers).toContain('zod');
    expect(specifiers).toContain('@/lib/modules/hooks');
    expect(specifiers).toContain('../services/auth-service');
    expect(specifiers).toContain('bcryptjs');
    expect(specifiers).toContain('@/lib/core/db');
  });

  it('ServiceIntegrationTestBuilder - should cover complex type normalization', () => {
    const builder = new ServiceIntegrationTestBuilder('api', 'Action', 'Array<User>', 'void');
    const schema = (
      builder as unknown as { getSchema(): { imports: { namedImports: string[] }[] } }
    ).getSchema();
    expect(schema.imports.some((i) => i.namedImports.includes('User'))).toBe(true);
  });

  it('ActorBuilder - should cover ALL strategies exhaustive', () => {
    const models = [
      {
        name: 'User',
        fields: { role: { type: 'String' } },
        actor: { strategy: 'login', fields: { identifier: 'email', secret: 'password' } },
      },
      {
        name: 'ServiceAccount',
        fields: {},
        actor: { strategy: 'api-key', fields: { keyModel: 'AccountKey', ownerField: 'user' } },
      },
    ];
    const builder = new ActorBuilder(models as unknown as ModelDef[]);
    const schema = (
      builder as unknown as { getSchema(): { variables: { initializer: string }[] } }
    ).getSchema();
    expect(schema.variables[0].initializer).toContain('user:');
    expect(schema.variables[0].initializer).toContain('serviceAccount:');
    expect(schema.variables[0].initializer).toContain('params.password');
    expect(schema.variables[0].initializer).toContain('crypto.randomBytes');
  });

  it('ApiModuleGenerator - should generate base-role with corrected inherits and no db import', () => {
    const generator = new ApiModuleGenerator('/tmp/test-api', {
      command: {
        name: 'test-api',
        path: '/tmp/test-api',
        config: {
          roles: {
            admin: {
              inherits: ['user'],
            },
          },
        },
      },
    } as unknown as ConstructorParameters<typeof ApiModuleGenerator>[1]);
    const roleText = (
      generator as unknown as { debugBaseRoleText(config: unknown): string }
    ).debugBaseRoleText({} as unknown);
    expect(roleText).not.toContain('@/lib/core/db');
  });

  it('ActionBuilder - should cover more branches', () => {
    const builder = new ActionBuilder('BranchAction', 'string', 'number');
    const mockMethod = {
      isStatic: () => false,
      getBodyText: () => 'console.log("non-static");',
      getParameters: () => [{ getType: () => ({ getText: () => 'any' }) }],
    };
    const mockClass = {
      getMethod: (name: string) => (name === 'run' ? mockMethod : null),
      getStaticMethod: (name: string) => null,
      getMethods: () => [mockMethod],
      getProperties: () => [],
      getConstructors: () => [],
      getDecorators: () => [],
    };
    const mockFile = {
      getClass: (name: string) => mockClass,
      getFullText: () => 'OrchestrationService; db.user;',
      getClasses: () => [mockClass],
      getImportDeclarations: () => [],
    };

    const schema = (
      builder as unknown as {
        getSchema: (n: unknown) => { classes: { methods: { name: string }[] }[] };
      }
    ).getSchema(mockFile as unknown);
    expect(schema.classes[0].methods[0].name).toBe('run');
  });
});
