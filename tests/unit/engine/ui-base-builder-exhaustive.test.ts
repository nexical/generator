import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs';
import {
  UiBaseBuilder,
  type UiConfig,
} from '@nexical/generator/engine/builders/ui/ui-base-builder.js';
import { type ModuleConfig } from '@nexical/generator/engine/types.js';
import { PathResolver } from '@nexical/generator/utils/path-resolver.js';
import { ModelParser } from '@nexical/generator/engine/model-parser.js';

// Concrete implementation for testing
class TestUiBuilder extends UiBaseBuilder {
  public exposeLoadUiConfig() {
    return this.loadUiConfig();
  }
  public exposeResolveModels() {
    return this.resolveModels();
  }
  public exposeResolveRoutes() {
    return this.resolveRoutes();
  }
  public exposeGetModuleTypeName() {
    return this.getModuleTypeName();
  }
  public setUiConfig(config: UiConfig) {
    this.uiConfig = config;
  }
  public exposeGetSchema() {
    return this.getSchema();
  }
}

vi.mock('@nexical/generator/utils/path-resolver.js');

vi.mock('@nexical/generator/engine/model-parser.js', () => ({
  ModelParser: {
    parse: vi.fn(),
  },
}));

describe('UiBaseBuilder - Exhaustive Coverage', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(
      os.tmpdir(),
      `ui-base-builder-exhaustive-${Math.random().toString(36).slice(2)}`,
    );
    fs.mkdirSync(tmpDir, { recursive: true });

    // Default mock implementation
    vi.mocked(PathResolver.resolve).mockImplementation((name: string) => {
      return path.join(tmpDir, name);
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should throw in getSchema (lines 45-47)', () => {
    const builder = new TestUiBuilder('test', { name: 'test' } as ModuleConfig, tmpDir);
    expect(() => builder.exposeGetSchema()).toThrow(
      'UiBaseBuilder subclasses often manage their own file generation loop',
    );
  });

  describe('loadUiConfig', () => {
    it('should return if modulePath is missing (lines 51-53)', () => {
      const builder = new TestUiBuilder('test', { name: 'test' } as ModuleConfig, '');
      builder.exposeLoadUiConfig();
      // No config loaded
    });

    it('should warn if ui.yaml not found (lines 62-64)', () => {
      const builder = new TestUiBuilder('test', { name: 'test' } as ModuleConfig, tmpDir);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      builder.exposeLoadUiConfig();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ui.yaml NOT FOUND'));
      warnSpy.mockRestore();
    });

    it('should load valid ui.yaml (line 58)', () => {
      const builder = new TestUiBuilder('test', { name: 'test' } as ModuleConfig, tmpDir);
      fs.writeFileSync(path.join(tmpDir, 'ui.yaml'), 'backend: my-api\nprefix: test');
      builder.exposeLoadUiConfig();
      expect((builder as unknown as { uiConfig: UiConfig }).uiConfig.backend).toBe('my-api');
    });

    it('should warn on invalid ui.yaml (lines 59-61)', () => {
      const builder = new TestUiBuilder('test', { name: 'test' } as ModuleConfig, tmpDir);
      fs.writeFileSync(path.join(tmpDir, 'ui.yaml'), 'invalid: yaml: :');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      builder.exposeLoadUiConfig();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse ui.yaml'));
      warnSpy.mockRestore();
    });
  });

  describe('resolveModels', () => {
    it('should return empty if models.yaml not found (lines 72-74)', () => {
      const builder = new TestUiBuilder('test-ui', { name: 'test-ui' } as ModuleConfig, tmpDir);
      const models = builder.exposeResolveModels();
      expect(models).toEqual([]);
    });

    it('should return parsed models (line 78)', () => {
      const builder = new TestUiBuilder('test-ui', { name: 'test-ui' } as ModuleConfig, tmpDir);
      const backendPath = path.join(tmpDir, 'test-ui');
      fs.mkdirSync(backendPath, { recursive: true });
      fs.writeFileSync(path.join(backendPath, 'models.yaml'), 'dummy');

      (ModelParser.parse as unknown as import('vitest').Mock).mockReturnValue({
        models: [{ name: 'User' }],
      } as unknown as {
        models: import('@nexical/generator/engine/types.js').ModelDef[];
        enums: import('@nexical/generator/engine/types.js').EnumConfig[];
        config: import('@nexical/generator/engine/types.js').GlobalConfig;
      });

      const models = builder.exposeResolveModels();
      expect(models).toEqual([{ name: 'User' }]);
    });

    it('should return empty on parse error (lines 79-81)', () => {
      const builder = new TestUiBuilder('test-ui', { name: 'test-ui' } as ModuleConfig, tmpDir);
      const backendPath = path.join(tmpDir, 'test-ui');
      fs.mkdirSync(backendPath, { recursive: true });
      fs.writeFileSync(path.join(backendPath, 'models.yaml'), 'dummy');

      (ModelParser.parse as unknown as import('vitest').Mock).mockImplementation(() => {
        throw new Error('Parse error');
      });

      const models = builder.exposeResolveModels();
      expect(models).toEqual([]);
    });
  });

  describe('resolveRoutes', () => {
    it('should return empty if api.yaml not found (lines 89-91)', () => {
      const builder = new TestUiBuilder('test-ui', { name: 'test-ui' } as ModuleConfig, tmpDir);
      const routes = builder.exposeResolveRoutes();
      expect(routes).toEqual([]);
    });

    it('should return parsed routes (lines 99-106)', () => {
      const builder = new TestUiBuilder('test-ui', { name: 'test-ui' } as ModuleConfig, tmpDir);
      const backendPath = path.join(tmpDir, 'test-ui');
      fs.mkdirSync(backendPath, { recursive: true });
      fs.writeFileSync(
        path.join(backendPath, 'api.yaml'),
        'User:\n  - path: /users\n    method: GET',
      );

      const routes = builder.exposeResolveRoutes();
      expect(routes).toEqual([{ path: '/users', method: 'GET', modelName: 'User' }]);
    });

    it('should skip non-array routes (line 100)', () => {
      const builder = new TestUiBuilder('test-ui', { name: 'test-ui' } as ModuleConfig, tmpDir);
      const backendPath = path.join(tmpDir, 'test-ui');
      fs.mkdirSync(backendPath, { recursive: true });
      fs.writeFileSync(path.join(backendPath, 'api.yaml'), 'User: not-an-array');

      const routes = builder.exposeResolveRoutes();
      expect(routes).toEqual([]);
    });

    it('should return empty on parse error (lines 107-109)', () => {
      const builder = new TestUiBuilder('test-ui', { name: 'test-ui' } as ModuleConfig, tmpDir);
      const backendPath = path.join(tmpDir, 'test-ui');
      fs.mkdirSync(backendPath, { recursive: true });
      fs.writeFileSync(path.join(backendPath, 'api.yaml'), 'invalid: yaml: :');

      const routes = builder.exposeResolveRoutes();
      expect(routes).toEqual([]);
    });
  });

  describe('getModuleTypeName', () => {
    it('should return GlobalModuleTypes if no targetModule (line 114)', () => {
      const builder = new TestUiBuilder('', { name: '' } as ModuleConfig, tmpDir);
      builder.setUiConfig({ backend: '' });
      expect(builder.exposeGetModuleTypeName()).toBe('GlobalModuleTypes');
    });

    it('should handle -api suffix (lines 115-117)', () => {
      const builder = new TestUiBuilder('user-api', { name: 'user-api' } as ModuleConfig, tmpDir);
      expect(builder.exposeGetModuleTypeName()).toBe('UserModuleTypes');
    });

    it('should handle regular name (line 118)', () => {
      const builder = new TestUiBuilder('user', { name: 'user' } as ModuleConfig, tmpDir);
      expect(builder.exposeGetModuleTypeName()).toBe('UserModuleTypes');
    });
  });
});
