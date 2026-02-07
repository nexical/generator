/** @vitest-environment node */
/* eslint-disable */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiModuleGenerator } from '@nexical/generator/engine/api-module-generator';
import { ModelParser } from '@nexical/generator/engine/model-parser';
import { ServiceBuilder } from '@nexical/generator/engine/builders/service-builder';
import { ApiBuilder } from '@nexical/generator/engine/builders/api-builder';
import fs from 'fs';

import { logger } from '@nexical/cli-core';

vi.mock('@nexical/generator/engine/model-parser');
vi.mock('@nexical/generator/engine/builders/service-builder');
vi.mock('@nexical/generator/engine/builders/api-builder');
vi.mock('@nexical/cli-core', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  BaseCommand: class {},
}));
vi.mock('@nexical/generator/utils/template-loader', () => ({
  TemplateLoader: {
    load: () => ({
      raw: '/* mocked content */',
      getNodes: () => [],
    }),
  },
}));
const fsMocks = vi.hoisted(() => {
  return {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: fsMocks,
    ...fsMocks,
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: fsMocks,
    ...fsMocks,
  };
});

describe('ApiModuleGenerator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should orchestration the full generation process', async () => {
    const mockModels = [
      {
        name: 'User',
        api: true,
        db: true,
        fields: { email: { type: 'String' } },
        test: { actor: 'User' },
      },
    ];
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: mockModels as any,
      enums: [],
      config: {},
    });

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (p.toString().endsWith('models.yaml')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('api: true');

    const generator = new ApiModuleGenerator('/tmp/user-api');

    // Mock ensure for all builders
    const mockEnsure = vi.fn();
    vi.mocked(ServiceBuilder).mockImplementation(function () {
      return { ensure: mockEnsure } as any;
    } as any);
    vi.mocked(ApiBuilder).mockImplementation(function () {
      return { ensure: mockEnsure } as any;
    } as any);

    await generator.run();

    expect(ModelParser.parse).toHaveBeenCalled();
    expect(ServiceBuilder).toHaveBeenCalled();
    expect(ApiBuilder).toHaveBeenCalled();
    expect(mockEnsure).toHaveBeenCalled();
  });

  it('should skip generation if no models found', async () => {
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [],
      enums: [],
      config: {},
    });
    const generator = new ApiModuleGenerator('/tmp/user-api');
    await generator.run();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No models found'));
  });

  it('should handle virtual resources from api.yaml', async () => {
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [{ name: 'User', api: true, db: true, fields: {}, test: { actor: 'User' } }] as any,
      enums: [],
      config: {},
    });

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (p.toString().endsWith('api.yaml')) return true;
      if (p.toString().endsWith('models.yaml')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(
      'Root: [{ method: "ping", path: "/ping", verb: "GET", input: "none", output: "none" }]',
    );

    const generator = new ApiModuleGenerator('/tmp/user-api');
    const mockEnsure = vi.fn();
    vi.mocked(ApiBuilder).mockImplementation(function () {
      return { ensure: mockEnsure } as any;
    } as any);

    await generator.run();
    expect(ApiBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Root' }),
      expect.any(Array),
      expect.any(String),
      'custom',
      expect.any(Array),
    );
  });

  it('should hit diverse branches (non-db models, normalization, paths)', async () => {
    const mockModels = [
      { name: 'External', api: true, db: false, fields: {}, extended: false },
      { name: 'Legacy', api: true, db: true, fields: {}, extended: true },
    ];
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: mockModels as any,
      enums: [],
      config: {},
    });

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (p.toString().endsWith('api.yaml')) return true;
      if (p.toString().endsWith('models.yaml')) return true;
      return false;
    });
    // Test normalization of path and verb
    vi.mocked(fs.readFileSync).mockReturnValue(
      'External: [{ method: "sync", path: "sync", verb: "", input: "none", output: "none" }]',
    );

    const generator = new ApiModuleGenerator('/tmp/user-api');
    const mockEnsure = vi.fn();
    vi.mocked(ApiBuilder).mockImplementation(function () {
      return { ensure: mockEnsure } as any;
    } as any);

    await generator.run();

    // 1. External should NOT call ServiceBuilder because db: false
    expect(ServiceBuilder).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'External' }));
    // 2. Legacy should NOT call ServiceBuilder because extended: true
    expect(ServiceBuilder).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'Legacy' }));
    // 3. Normalization: verb should default to POST if missing/empty
    expect(ApiBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'External' }),
      expect.any(Array),
      expect.any(String),
      'custom',
      expect.arrayContaining([expect.objectContaining({ verb: 'POST' })]),
    );
  });
});
