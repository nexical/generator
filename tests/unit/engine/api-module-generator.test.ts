import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiModuleGenerator } from '@nexical/generator/engine/api-module-generator.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';
import fs from 'node:fs';

const parseSpy = vi.fn();
vi.mock('@nexical/generator/engine/model-parser.js', () => ({
  ModelParser: {
    parse: (...args: unknown[]) => parseSpy(...args),
  },
}));

vi.mock('node:fs');

// Mock ALL builders used in ApiModuleGenerator
vi.mock('@nexical/generator/engine/builders/type-builder.js', () => ({
  TypeBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/service-builder.js', () => ({
  ServiceBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/api-builder.js', () => ({
  ApiBuilder: class {
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
vi.mock('@nexical/generator/engine/builders/sdk-builder.js', () => ({
  SdkBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/test/integration/integration-test-builder.js', () => ({
  IntegrationTestBuilder: class {
    ensure() {}
  },
}));
vi.mock('@nexical/generator/engine/builders/sdk-index-builder.js', () => ({
  SdkIndexBuilder: class {
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
vi.mock('@nexical/generator/engine/builders/init-builder.js', () => ({
  InitBuilder: class {
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
vi.mock('@nexical/generator/engine/builders/middleware-builder.js', () => ({
  MiddlewareBuilder: class {
    ensure() {}
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
  Reconciler: { reconcile: vi.fn() },
}));

describe('ApiModuleGenerator Functional Mocked', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Set real FS for TemplateLoader
    const realFs = await vi.importActual<typeof fs>('node:fs');
    TemplateLoader.setFileSystem(realFs);
  });

  afterEach(() => {
    TemplateLoader.restoreDefaultFileSystem();
  });

  it('should skip generation when no models or custom routes found', async () => {
    parseSpy.mockReturnValue({ models: [], enums: [], config: {} });
    const generator = new ApiModuleGenerator('/tmp/mock-path');
    await generator.run();
    expect(parseSpy).toHaveBeenCalled();
  });

  it('should run successfully with standard models and generate types', async () => {
    const mockModel = {
      name: 'User',
      api: true,
      db: true,
      fields: { name: { type: 'String' } },
    };

    parseSpy.mockReturnValue({
      models: [mockModel],
      enums: [],
      config: {},
    });

    const generator = new ApiModuleGenerator('/tmp/mock-path');
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'saveAll',
    ).mockResolvedValue(undefined);
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'runCustomBuilders',
    ).mockResolvedValue(undefined);
    await generator.run();

    expect(parseSpy).toHaveBeenCalled();
  });

  it('should skip model if neither db nor api is true', async () => {
    const mockModel = {
      name: 'IgnoredModel',
      api: false,
      db: false,
      fields: {},
    };

    parseSpy.mockReturnValue({
      models: [mockModel],
      enums: [],
      config: {},
    });

    const generator = new ApiModuleGenerator('/tmp/mock-path');
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'saveAll',
    ).mockResolvedValue(undefined);
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'runCustomBuilders',
    ).mockResolvedValue(undefined);
    await generator.run();
  });

  it('should correctly process model with complex role object', async () => {
    const mockModel = {
      name: 'CustomRoleModel',
      api: true,
      db: true,
      role: { create: 'admin', get: 'none' }, // testing object role mapping and "none" skip
      fields: {},
    };

    parseSpy.mockReturnValue({
      models: [mockModel],
      enums: [],
      config: {},
    });

    const generator = new ApiModuleGenerator('/tmp/mock-path');
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'saveAll',
    ).mockResolvedValue(undefined);
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'runCustomBuilders',
    ).mockResolvedValue(undefined);
    await generator.run();
  });

  it('should correctly process model with explicit string "none" role', async () => {
    const mockModel = {
      name: 'ExplicitNoneRoleModel',
      api: true,
      db: true,
      role: 'none',
      fields: {},
    };

    parseSpy.mockReturnValue({
      models: [mockModel],
      enums: [],
      config: {},
    });

    const generator = new ApiModuleGenerator('/tmp/mock-path');
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'saveAll',
    ).mockResolvedValue(undefined);
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'runCustomBuilders',
    ).mockResolvedValue(undefined);
    await generator.run();
  });

  it('should correct process model with api only and custom routes', async () => {
    const mockModel = {
      name: 'ApiOnlyModel',
      api: true,
      db: false,
      fields: {},
    };

    const customRoutesContent = `
ApiOnlyModel:
  - path: /custom
    input: none
    output: none
    method: GET
`;
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => String(p).endsWith('.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue(customRoutesContent);

    parseSpy.mockReturnValue({
      models: [mockModel],
      enums: [],
      config: {},
    });

    const generator = new ApiModuleGenerator('/tmp/mock-path');
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'saveAll',
    ).mockResolvedValue(undefined);
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'runCustomBuilders',
    ).mockResolvedValue(undefined);
    await generator.run();
  });

  it('should process virtual models without problems', async () => {
    const customRoutesContent = `
VirtualEntity:
  - path: /virtual
    input: none
    output: none
    method: doSomething
    verb: POST
`;
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => String(p).endsWith('.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue(customRoutesContent);

    parseSpy.mockReturnValue({
      models: [],
      enums: [],
      config: {},
    });

    const generator = new ApiModuleGenerator('/tmp/mock-path');
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'saveAll',
    ).mockResolvedValue(undefined);
    vi.spyOn(
      generator as unknown as Record<string, () => Promise<void>>,
      'runCustomBuilders',
    ).mockResolvedValue(undefined);
    await generator.run();
  });

  it('should throw error when custom route is missing input', async () => {
    const customRoutesContent = `
VirtualEntity:
  - path: /virtual
    output: none
`;
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => String(p).endsWith('.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue(customRoutesContent);

    parseSpy.mockReturnValue({
      models: [],
      enums: [],
      config: {},
    });

    const generator = new ApiModuleGenerator('/tmp/mock-path');
    await expect(generator.run()).rejects.toThrow(/missing 'input'/);
  });

  it('should throw error when custom route is missing output', async () => {
    const customRoutesContent = `
VirtualEntity:
  - path: /virtual
    input: none
`;
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => String(p).endsWith('.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue(customRoutesContent);

    parseSpy.mockReturnValue({
      models: [],
      enums: [],
      config: {},
    });

    const generator = new ApiModuleGenerator('/tmp/mock-path');
    await expect(generator.run()).rejects.toThrow(/missing 'output'/);
  });
});
