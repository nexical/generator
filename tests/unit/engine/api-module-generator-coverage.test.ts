import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiModuleGenerator } from '@nexical/generator/engine/api-module-generator.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';
import fs from 'node:fs';
import { type BaseCommand } from '@nexical/cli-core';
import { ModelParser } from '@nexical/generator/engine/model-parser.js';
import {
  type ModelDef,
  type EnumConfig,
  type GlobalConfig,
} from '@nexical/generator/engine/types.js';

vi.mock('node:fs');
vi.mock('@nexical/cli-core', async () => {
  const actual = await vi.importActual('@nexical/cli-core');
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('@nexical/generator/engine/model-parser.js', () => ({
  ModelParser: {
    parse: vi.fn(),
  },
}));
vi.mock('@nexical/generator/utils/formatter.js', () => ({
  Formatter: {
    format: vi.fn((c) => c),
  },
}));

// Mock builders to avoid dependencies
vi.mock('@nexical/generator/engine/builders/service-builder.js', () => ({
  ServiceBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/api-builder.js', () => ({
  ApiBuilder: vi.fn(
    class {
      ensure = vi.fn();
    },
  ),
}));
vi.mock('@nexical/generator/engine/builders/sdk-builder.js', () => ({
  SdkBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/sdk-index-builder.js', () => ({
  SdkIndexBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/init-builder.js', () => ({
  InitBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/integration/integration-test-builder.js', () => ({
  IntegrationTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/action-builder.js', () => ({
  ActionBuilder: class {
    ensure() {}
  },
}));
vi.mock(
  '@nexical/generator/engine/builders/test/integration/service-integration-test-builder.js',
  () => ({
    ServiceIntegrationTestBuilder: class {
      ensure() {}
    },
  }),
);
vi.mock('@nexical/generator/engine/builders/type-builder.js', () => ({
  TypeBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/factory-builder.js', () => ({
  FactoryBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/actor-builder.js', () => ({
  ActorBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/actor-type-builder.js', () => ({
  ActorTypeBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/middleware-builder.js', () => ({
  MiddlewareBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/email-builder.js', () => ({
  EmailBuilder: class {
    build() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/agent-builder.js', () => ({
  AgentBuilder: class {
    build() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/hook-builder.js', () => ({
  HookBuilder: class {
    build() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/role-builder.js', () => ({
  RoleBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/unit/api-unit-test-builder.js', () => ({
  ApiUnitTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/unit/action-unit-test-builder.js', () => ({
  ActionUnitTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/unit/service-unit-test-builder.js', () => ({
  ServiceUnitTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/unit/sdk-unit-test-builder.js', () => ({
  SdkUnitTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/unit/role-unit-test-builder.js', () => ({
  RoleUnitTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/unit/hook-unit-test-builder.js', () => ({
  HookUnitTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/unit/agent-unit-test-builder.js', () => ({
  AgentUnitTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/unit/config-unit-test-builder.js', () => ({
  ConfigUnitTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/unit/middleware-unit-test-builder.js', () => ({
  MiddlewareUnitTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/unit/permission-unit-test-builder.js', () => ({
  PermissionUnitTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/reconciler.js', () => ({
  Reconciler: {
    reconcile: vi.fn(),
    validate: vi.fn(),
  },
}));

describe('ApiModuleGenerator Coverage', () => {
  const modulePath = '/tmp/test-api';
  let command: Record<string, unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    command = {
      name: 'test-api',
      path: modulePath,
      info: vi.fn(),
      config: {
        test: { roles: { admin: { role: 'admin' } } },
      },
    };
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [],
      enums: [],
      config: { test: { roles: { admin: { role: 'admin' } } } },
    } as unknown as { models: ModelDef[]; enums: EnumConfig[]; config: GlobalConfig });
    vi.mocked(fs.readdirSync).mockImplementation((() => []) as unknown as typeof fs.readdirSync);
    vi.mocked(fs.lstatSync).mockReturnValue({ isDirectory: () => false } as unknown as fs.Stats);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    // Set real FS for TemplateLoader
    const realFs = await vi.importActual<typeof fs>('node:fs');
    TemplateLoader.setFileSystem(realFs);
  });

  afterEach(() => {
    TemplateLoader.restoreDefaultFileSystem();
  });

  const setupMocks = (generator: ApiModuleGenerator, roleName: string = 'admin') => {
    (generator as unknown as { getOrCreateFile: import('vitest').Mock }).getOrCreateFile = vi
      .fn()
      .mockImplementation((path: string) => ({
        ensure: vi.fn(),
        getFilePath: () => path,
        replaceWithText: vi.fn(),
        getFullText: () => '',
        getText: () => '',
        name: roleName,
      }));
    (generator as unknown as { saveAll: import('vitest').Mock }).saveAll = vi
      .fn()
      .mockResolvedValue(undefined);
    (generator as unknown as { runCustomBuilders: import('vitest').Mock }).runCustomBuilders = vi
      .fn()
      .mockResolvedValue(undefined);
  };

  it('should cover early exit paths exhaustive', async () => {
    const generatorWithCmd = new ApiModuleGenerator(modulePath, {
      command: command as unknown as BaseCommand,
    });
    await generatorWithCmd.run();
    expect(command.info).toHaveBeenCalled();

    const generatorNoCmd = new ApiModuleGenerator(modulePath, {});
    await generatorNoCmd.run();
  });

  it('should cover exhaustive model roles and flags', async () => {
    const generator = new ApiModuleGenerator(modulePath, {});
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [
        { name: 'User', db: true, api: true, role: 'admin', fields: {} } as ModelDef,
        {
          name: 'Mapping',
          db: true,
          api: true,
          role: { create: 'manager', list: 'none', get: '', update: 'admin' },
          fields: {},
        } as ModelDef,
        { name: 'OnlyApi', db: false, api: true, fields: {} } as ModelDef, // 59 false
        { name: 'OnlyDb', db: true, api: false, fields: {} } as ModelDef, // 59 false
        { name: 'Disabled', db: false, api: false, fields: {} } as ModelDef, // 59 true -> continue
        { name: 'Extended', db: true, api: true, extended: true, fields: {} } as ModelDef, // 70 true, 145 true
      ],
      enums: [],
      config: { test: { roles: {} } },
    });
    vi.mocked(fs.existsSync).mockImplementation(((p: string) =>
      p.endsWith('api.yaml')) as unknown as typeof fs.existsSync);
    // whitespace and null parse
    vi.mocked(fs.readFileSync).mockReturnValue('   ' as unknown as string);
    setupMocks(generator);
    await generator.run();

    vi.mocked(fs.readFileSync).mockReturnValue('# comment');
    await generator.run();

    // Valid variant with real types
    vi.mocked(fs.readFileSync).mockReturnValue(
      'User: [{ path: "/foo", method: "post", input: "User", output: "User", action: "custom-dash", verb: "POST" }]',
    );
    await generator.run();
  });

  it('should handle model and virtual route exhaustive variations', async () => {
    const generator = new ApiModuleGenerator(modulePath, {});
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [{ name: 'Task', api: true, db: true, fields: {} } as ModelDef],
      enums: [],
      config: { test: {} },
    });
    vi.mocked(fs.existsSync).mockImplementation(((p: string) =>
      p.endsWith('api.yaml')) as unknown as typeof fs.existsSync);
    vi.mocked(fs.readFileSync).mockReturnValue(
      `
Task:
  - path: "" # 91 -> index
    method: post
    input: none
    output: none
  - path: "run" # 91 -> run
    method: runTask # 128
    input: none
    output: none
Root: # 191
  - path: "/" # 214 -> index
    method: GET # 209
    input: none
    output: none
Virtual:
  - path: "Virtual"
    method: Virtual
    input: "VirtualInput"
    output: "VirtualOutput"
    action: "my-act" # 259, 262
` as unknown as string & Buffer,
    );
    setupMocks(generator);
    await generator.run();
  });

  it('should trigger security layers and re-parsing exhaustive', async () => {
    const generator = new ApiModuleGenerator(modulePath, {});
    // Trigger loop truthy (399-401)
    (generator as unknown as { config: unknown }).config = {
      test: { roles: { admin: { role: 'R1' } } },
    };

    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [{ name: 'User', api: true, db: true }],
      enums: [],
      config: { test: {} },
    } as unknown as {
      models: import('@nexical/generator/engine/types.js').ModelDef[];
      enums: import('@nexical/generator/engine/types.js').EnumConfig[];
      config: import('@nexical/generator/engine/types.js').GlobalConfig;
    });
    vi.mocked(fs.existsSync).mockImplementation(
      ((p: string) =>
        p.endsWith('api.yaml') || p.endsWith('access.yaml')) as unknown as typeof fs.existsSync,
    );

    // Test re-parsing branch 372-380
    let accessReadCount = 0;
    vi.mocked(fs.readFileSync).mockImplementation(((p: string) => {
      if (p.endsWith('api.yaml'))
        return 'User: [{ path: "/foo", method: "bar", input: "none", output: "none" }]';
      if (p.endsWith('access.yaml')) {
        accessReadCount++;
        if (accessReadCount === 1) return '   '; // empty 294 -> skips 297
        return 'roles:\n  admin:\n    permissions: ["p1"]\npermissions:\n  p1: "desc"'; // valid 374, 376 -> hits 377
      }
      return '';
    }) as unknown as typeof fs.readFileSync);

    setupMocks(generator, 'admin');
    await generator.run();
    expect(accessReadCount).toBe(2);

    // Test accessConfig without roles/permissions (382, 384, 413 false)
    vi.mocked(fs.readFileSync).mockReturnValue('   ');
    await generator.run();
  });

  it('should throw on validation exhaustive', async () => {
    const generator = new ApiModuleGenerator(modulePath, {});
    vi.mocked(fs.existsSync).mockImplementation(((p: string) =>
      p.endsWith('api.yaml')) as unknown as typeof fs.existsSync);
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [{ name: 'User', api: true, db: true }],
      enums: [],
      config: { test: {} },
    } as unknown as {
      models: import('@nexical/generator/engine/types.js').ModelDef[];
      enums: import('@nexical/generator/engine/types.js').EnumConfig[];
      config: import('@nexical/generator/engine/types.js').GlobalConfig;
    });

    vi.mocked(fs.readFileSync).mockReturnValue('User: [{ path: "/foo", method: "post" }]');
    await expect(generator.run()).rejects.toThrow();
    vi.mocked(fs.readFileSync).mockReturnValue(
      'User: [{ path: "/foo", method: "post", input: "none" }]',
    );
    await expect(generator.run()).rejects.toThrow();

    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [],
      enums: [],
      config: { test: {} },
    } as unknown as {
      models: import('@nexical/generator/engine/types.js').ModelDef[];
      enums: import('@nexical/generator/engine/types.js').EnumConfig[];
      config: import('@nexical/generator/engine/types.js').GlobalConfig;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('Virtual: [{ path: "/foo", method: "post" }]');
    await expect(generator.run()).rejects.toThrow();
    vi.mocked(fs.readFileSync).mockReturnValue(
      'Virtual: [{ path: "/foo", method: "post", input: "none" }]',
    );
    await expect(generator.run()).rejects.toThrow();
  });

  it('should handle cleanup branches and empty config', async () => {
    const generator = new ApiModuleGenerator(modulePath, {});
    (generator as unknown as { config: unknown }).config = undefined; // 397 branch false
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [{ name: 'User', api: true, db: true }],
      enums: [],
      config: { test: {} },
    } as unknown as {
      models: import('@nexical/generator/engine/types.js').ModelDef[];
      enums: import('@nexical/generator/engine/types.js').EnumConfig[];
      config: import('@nexical/generator/engine/types.js').GlobalConfig;
    });
    vi.mocked(fs.existsSync).mockImplementation(
      ((p: string) =>
        p.endsWith('actor-types.ts') ||
        p.endsWith('access.yaml')) as unknown as typeof fs.existsSync,
    );
    vi.mocked(fs.readFileSync).mockReturnValue('roles: { admin: {} }');
    setupMocks(generator, 'admin');
    await generator.run();
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it('should test debugBaseRoleText', () => {
    const generator = new ApiModuleGenerator(modulePath, {});
    const text = generator.debugBaseRoleText({ roles: {}, permissions: {} });
    expect(text).toContain('export abstract class BaseRole');
  });

  it('should cover Root virtual model and normalization logic', async () => {
    const generator = new ApiModuleGenerator(modulePath, {});
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [],
      enums: [],
      config: { test: {} },
    } as unknown as { models: ModelDef[]; enums: EnumConfig[]; config: GlobalConfig });

    vi.mocked(fs.existsSync).mockImplementation(((p: string) =>
      p.endsWith('api.yaml')) as unknown as typeof fs.existsSync);
    vi.mocked(fs.readFileSync).mockReturnValue(
      `
Root:
  - path: "/"
    method: "POST"
    input: "none"
    output: "none"
  - path: "/health"
    method: "GET"
    input: "none"
    output: "none"
    action: "health-check"
` as unknown as string & Buffer,
    );

    setupMocks(generator);
    await generator.run();
  });

  it('should cover access.yaml config mapping and model role overrides', async () => {
    const generator = new ApiModuleGenerator(modulePath, {});
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [
        { name: 'User', db: true, api: true, role: 'none', fields: {} } as ModelDef,
        { name: 'Profile', db: true, api: true, role: { create: 'admin' }, fields: {} } as ModelDef,
      ],
      enums: [],
      config: { test: { roles: { admin: { role: 'R1' } } } },
    } as unknown as { models: ModelDef[]; enums: EnumConfig[]; config: GlobalConfig });

    vi.mocked(fs.existsSync).mockImplementation(((p: string) =>
      p.endsWith('access.yaml')) as unknown as typeof fs.existsSync);
    vi.mocked(fs.readFileSync).mockReturnValue(
      `
config:
  roles:
    admin:
      permissions: ["all"]
  permissions:
    all: "Full access"
` as unknown as string & Buffer,
    );

    setupMocks(generator);
    await generator.run();
  });

  it('should cover coverage sweeper and safety skips', async () => {
    const generator = new ApiModuleGenerator(modulePath, {});
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [],
      enums: [],
      config: { test: {} },
    } as unknown as { models: ModelDef[]; enums: EnumConfig[]; config: GlobalConfig });

    vi.mocked(fs.existsSync).mockImplementation(
      ((p: string) =>
        p.includes('src/hooks') ||
        p.includes('src/agent') ||
        p.includes('src/config') ||
        p.includes('src/services') ||
        p.endsWith('models.yaml')) as unknown as typeof fs.existsSync,
    );

    vi.mocked(fs.readdirSync).mockImplementation(((p: string) => {
      if (p.endsWith('src/hooks')) return ['hook.ts', 'react-hook.ts', 'no-init.ts'];
      if (p.endsWith('src/agent')) return ['agent.ts'];
      if (p.endsWith('src/config')) return ['config.ts'];
      if (p.endsWith('src/services')) return ['user-service.ts'];
      return [];
    }) as unknown as typeof fs.readdirSync);

    vi.mocked(fs.readFileSync).mockImplementation(((p: string) => {
      if (p.endsWith('react-hook.ts')) return 'import { useState } from "react";';
      if (p.endsWith('no-init.ts')) return 'export const someFunc = () => {};';
      if (p.endsWith('hook.ts')) return 'export const init = () => {};';
      return '';
    }) as unknown as typeof fs.readFileSync);

    setupMocks(generator);
    // Don't mock discoverMethods here to cover it
    // (generator as any).discoverMethods = vi.fn().mockReturnValue({ list: 1 });

    await generator.run();

    // Trigger branch where test file already has content and no GENERATED CODE
    (generator as unknown as { getOrCreateFile: import('vitest').Mock }).getOrCreateFile = vi
      .fn()
      .mockReturnValue({
        getText: () => 'Existing code',
        replaceWithText: vi.fn(),
        ensure: vi.fn(),
      });
    await (
      generator as unknown as { runCoverageSweeper: () => Promise<void> }
    ).runCoverageSweeper();
  });

  it('should cover method discovery logic parameter counting and fallbacks', () => {
    const generator = new ApiModuleGenerator(modulePath, {});
    (generator as unknown as { project: unknown }).project = {
      getSourceFile: vi.fn().mockReturnValue({
        getFullText: () => `
          export class TestService {
            async list() {}
            async get(id: string) {}
            async update(id: string, data: any) {}
            // Skip these
            async init() {}
            async run() {}
          }
        `,
      }),
    };

    const methods = (
      generator as unknown as { discoverMethods: (path: string) => Record<string, number> }
    ).discoverMethods('path/to/service.ts');
    expect(methods.list).toBe(0);
    expect(methods.get).toBe(1);
    expect(methods.update).toBe(2);
    expect(methods.init).toBeUndefined();

    // Absolute path branch
    (
      generator as unknown as { discoverMethods: (path: string) => Record<string, number> }
    ).discoverMethods('/absolute/path/to/service.ts');

    // Fallback case (null source file and fs exists)
    (
      generator as unknown as { project: { getSourceFile: import('vitest').Mock } }
    ).project.getSourceFile = vi.fn().mockReturnValue(null);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      'async custom(a, b, c) {}' as unknown as string & Buffer,
    );
    const customMethods = (
      generator as unknown as { discoverMethods: (path: string) => Record<string, number> }
    ).discoverMethods('existent.ts');
    expect(customMethods.custom).toBe(3);

    // No content case
    vi.mocked(fs.readFileSync).mockReturnValue('' as unknown as string & Buffer);
    const defaults = (
      generator as unknown as { discoverMethods: (path: string) => Record<string, number> }
    ).discoverMethods('existent.ts');
    expect(defaults.list).toBe(1);
  });
});
