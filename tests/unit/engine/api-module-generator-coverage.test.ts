import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiModuleGenerator } from '../../../src/engine/api-module-generator.js';
import { TemplateLoader } from '../../../src/utils/template-loader.js';
import fs from 'node:fs';
import { type BaseCommand } from '@nexical/cli-core';
import { ModelParser } from '../../../src/engine/model-parser.js';
import { type ModelDef, type EnumConfig, type GlobalConfig } from '../../../src/engine/types.js';

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

vi.mock('../../../src/engine/model-parser.js', () => ({
  ModelParser: {
    parse: vi.fn(),
  },
}));
vi.mock('../../../src/utils/formatter.js', () => ({
  Formatter: {
    format: vi.fn((c) => c),
  },
}));

// Mock builders to avoid dependencies
vi.mock('../../../src/engine/builders/service-builder.js', () => ({
  ServiceBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/api-builder.js', () => ({
  ApiBuilder: vi.fn(
    class {
      ensure = vi.fn();
    },
  ),
}));
vi.mock('../../../src/engine/builders/sdk-builder.js', () => ({
  SdkBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/sdk-index-builder.js', () => ({
  SdkIndexBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/init-builder.js', () => ({
  InitBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/test-builder.js', () => ({
  TestBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/action-builder.js', () => ({
  ActionBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/service-test-builder.js', () => ({
  ServiceTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/type-builder.js', () => ({
  TypeBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/factory-builder.js', () => ({
  FactoryBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/actor-builder.js', () => ({
  ActorBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/actor-type-builder.js', () => ({
  ActorTypeBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/middleware-builder.js', () => ({
  MiddlewareBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/builders/email-builder.js', () => ({
  EmailBuilder: class {
    build() {}
  },
}));
vi.mock('../../../src/engine/builders/agent-builder.js', () => ({
  AgentBuilder: class {
    build() {}
  },
}));
vi.mock('../../../src/engine/builders/hook-builder.js', () => ({
  HookBuilder: class {
    build() {}
  },
}));
vi.mock('../../../src/engine/builders/role-builder.js', () => ({
  RoleBuilder: vi.fn(
    class {
      ensure = vi.fn();
    },
  ),
}));
vi.mock('../../../src/engine/reconciler.js', () => ({
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
      models: import('../../../src/engine/types.js').ModelDef[];
      enums: import('../../../src/engine/types.js').EnumConfig[];
      config: import('../../../src/engine/types.js').GlobalConfig;
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
      models: import('../../../src/engine/types.js').ModelDef[];
      enums: import('../../../src/engine/types.js').EnumConfig[];
      config: import('../../../src/engine/types.js').GlobalConfig;
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
      models: import('../../../src/engine/types.js').ModelDef[];
      enums: import('../../../src/engine/types.js').EnumConfig[];
      config: import('../../../src/engine/types.js').GlobalConfig;
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
      models: import('../../../src/engine/types.js').ModelDef[];
      enums: import('../../../src/engine/types.js').EnumConfig[];
      config: import('../../../src/engine/types.js').GlobalConfig;
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
});
