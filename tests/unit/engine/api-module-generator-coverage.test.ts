import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiModuleGenerator } from '../../../src/engine/api-module-generator.js';
import fs from 'node:fs';
import { type BaseCommand } from '@nexical/cli-core';
import { ModelParser } from '../../../src/engine/model-parser.js';
import { type ModelDef, type EnumConfig, type GlobalConfig } from '../../../src/engine/types.js';

vi.mock('node:fs');
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
  ApiBuilder: class {
    ensure() {}
  },
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
  RoleBuilder: class {
    ensure() {}
  },
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

  beforeEach(() => {
    vi.clearAllMocks();
    command = {
      name: 'test-api',
      path: modulePath,
      info: vi.fn(),
      config: {
        roles: {
          user: { inherits: [] },
        },
      },
    };
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [],
      enums: [],
      config: {},
    } as unknown as { models: ModelDef[]; enums: EnumConfig[]; config: GlobalConfig });
    vi.mocked(fs.readdirSync).mockImplementation(((
      p: string,
    ) => []) as unknown as typeof fs.readdirSync);
    vi.mocked(fs.lstatSync).mockReturnValue({ isDirectory: () => false } as unknown as fs.Stats);
  });

  it('should bypass when no models or routes found', async () => {
    const generator = new ApiModuleGenerator(modulePath, {
      command: command as unknown as BaseCommand,
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await generator.run();
    expect(command.info).toHaveBeenCalledWith(
      expect.stringContaining('No models or custom routes found'),
    );
  });

  it('should cover security layer and various model flags', async () => {
    const generator = new ApiModuleGenerator(modulePath, {
      command: command as unknown as BaseCommand,
    });
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [
        { name: 'User', db: true, api: true } as unknown as ModelDef,
        { name: 'Extended', db: true, api: true, extended: true } as unknown as ModelDef, // Should skip builders
        { name: 'NoApi', db: true, api: false } as unknown as ModelDef,
      ],
      enums: [],
      config: { test: { roles: { admin: { role: 'super' } } } },
    } as unknown as { models: ModelDef[]; enums: EnumConfig[]; config: GlobalConfig });

    vi.mocked(fs.existsSync).mockImplementation(((p: string) => {
      if (p.endsWith('access.yaml')) return true;
      if (p.endsWith('api.yaml')) return true;
      return true;
    }) as unknown as typeof fs.existsSync);
    vi.mocked(fs.readFileSync).mockImplementation(((p: string) => {
      if (p.endsWith('access.yaml'))
        return `
roles:
  admin:
    permissions: ["p1"]
permissions:
  p1: "desc"
`;
      if (p.endsWith('api.yaml'))
        return `
User:
  - path: /login
    method: login
    input: none
    output: none
`;
      return '';
    }) as unknown as typeof fs.readFileSync);

    // Mock getOrCreateFile to avoid actual file creation
    const mockFile = {
      replaceWithText: vi.fn(),
      ensure: vi.fn(),
      getFilePath: () => 'src/roles/admin.ts',
    };
    (generator as unknown as Record<string, unknown>).getOrCreateFile = vi
      .fn()
      .mockReturnValue(mockFile);
    (generator as unknown as Record<string, unknown>).runCustomBuilders = vi
      .fn()
      .mockResolvedValue(undefined);

    await generator.run();
    expect((generator as unknown as Record<string, unknown>).getOrCreateFile).toHaveBeenCalledWith(
      expect.stringContaining('src/roles/admin.ts'),
    );
  });

  it('should handle models with complex role mappings', async () => {
    const generator = new ApiModuleGenerator(modulePath, {
      command: command as unknown as BaseCommand,
    });
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [
        {
          name: 'Task',
          db: true,
          api: true,
          role: { create: 'admin', list: 'user' },
        } as unknown as ModelDef,
      ],
      enums: [],
      config: {},
    } as unknown as { models: ModelDef[]; enums: EnumConfig[]; config: GlobalConfig });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    (generator as unknown as Record<string, unknown>).getOrCreateFile = vi
      .fn()
      .mockReturnValue({ ensure: vi.fn(), getFilePath: () => 'test.ts' });
    (generator as unknown as Record<string, unknown>).saveAll = vi
      .fn()
      .mockResolvedValue(undefined);

    await generator.run();
  });

  it('should handle root-level custom routes', async () => {
    const generator = new ApiModuleGenerator(modulePath, {
      command: command as unknown as BaseCommand,
    });
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [],
      enums: [],
      config: {},
    } as unknown as { models: ModelDef[]; enums: EnumConfig[]; config: GlobalConfig });
    vi.mocked(fs.existsSync).mockImplementation(((p: string) =>
      p.endsWith('api.yaml')) as unknown as typeof fs.existsSync);
    vi.mocked(fs.readFileSync).mockReturnValue(`
Root:
  - path: /ping
    method: ping
    input: none
    output: none
`);
    (generator as unknown as Record<string, unknown>).getOrCreateFile = vi
      .fn()
      .mockReturnValue({ ensure: vi.fn(), getFilePath: () => 'test.ts' });
    (generator as unknown as Record<string, unknown>).saveAll = vi
      .fn()
      .mockResolvedValue(undefined);

    await generator.run();
  });

  it('should cover accessConfig re-parsing and missing testRoles', async () => {
    const generator = new ApiModuleGenerator(modulePath, {
      command: command as unknown as BaseCommand,
    });
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [{ name: 'User', db: true, api: true }] as unknown as ModelDef[],
      enums: [],
      config: {},
    } as unknown as { models: ModelDef[]; enums: EnumConfig[]; config: GlobalConfig });

    vi.mocked(fs.existsSync).mockImplementation(((p: string) =>
      p.endsWith('access.yaml')) as unknown as typeof fs.existsSync);
    // roles key but NO permissions key to cover that branch
    vi.mocked(fs.readFileSync).mockReturnValue('roles: { admin: { inherits: ["user"] } }');

    (generator as unknown as Record<string, unknown>).getOrCreateFile = vi
      .fn()
      .mockReturnValue({ ensure: vi.fn(), getFilePath: () => 'test.ts', replaceWithText: vi.fn() });
    (generator as unknown as Record<string, unknown>).saveAll = vi
      .fn()
      .mockResolvedValue(undefined);
    (generator as unknown as Record<string, unknown>).runCustomBuilders = vi
      .fn()
      .mockResolvedValue(undefined);

    await generator.run();
  });

  it('should cover permissions ONLY branch in accessConfig', async () => {
    const generator = new ApiModuleGenerator(modulePath, {
      command: command as unknown as BaseCommand,
    });
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [{ name: 'User', db: true, api: true }] as unknown as ModelDef[],
      enums: [],
      config: {},
    } as unknown as { models: ModelDef[]; enums: EnumConfig[]; config: GlobalConfig });

    vi.mocked(fs.existsSync).mockImplementation(((p: string) =>
      p.endsWith('access.yaml')) as unknown as typeof fs.existsSync);
    // permissions key but NO roles key
    vi.mocked(fs.readFileSync).mockReturnValue('permissions: { p1: "desc" }');

    (generator as unknown as Record<string, unknown>).getOrCreateFile = vi
      .fn()
      .mockReturnValue({ ensure: vi.fn(), getFilePath: () => 'test.ts', replaceWithText: vi.fn() });
    (generator as unknown as Record<string, unknown>).saveAll = vi
      .fn()
      .mockResolvedValue(undefined);
    (generator as unknown as Record<string, unknown>).runCustomBuilders = vi
      .fn()
      .mockResolvedValue(undefined);

    await generator.run();
  });
});
