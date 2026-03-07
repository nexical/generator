import { describe, it, expect, vi } from 'vitest';
import { ApiModuleGenerator } from '../../../src/engine/api-module-generator.js';
const parseSpy = vi.fn();
vi.mock('../../../src/engine/model-parser.js', () => ({
  ModelParser: {
    parse: (...args: unknown[]) => parseSpy(...args),
  },
}));

// Mock builders RELATIVELY to match source imports
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
vi.mock('../../../src/engine/builders/role-builder.js', () => ({
  RoleBuilder: class {
    ensure() {}
  },
}));
vi.mock('../../../src/engine/reconciler.js', () => ({
  Reconciler: { reconcile: vi.fn() },
}));

describe('ApiModuleGenerator Functional Mocked', () => {
  it('should run successfully with mocked parser', async () => {
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
    await generator.run();

    expect(parseSpy).toHaveBeenCalled();
  });
});
