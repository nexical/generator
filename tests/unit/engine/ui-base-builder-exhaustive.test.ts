import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs';
import { UiBaseBuilder, type UiConfig } from '../../../src/engine/builders/ui/ui-base-builder.js';
import { ModuleLocator } from '../../../src/lib/module-locator.js';
import { ModelParser } from '../../../src/engine/model-parser.js';

// Concrete implementation for testing
class TestUiBuilder extends UiBaseBuilder {
  public exposeLoadUiConfig() { return this.loadUiConfig(); }
  public exposeResolveModels() { return this.resolveModels(); }
  public exposeResolveRoutes() { return this.resolveRoutes(); }
  public exposeGetModuleTypeName() { return this.getModuleTypeName(); }
  public setUiConfig(config: UiConfig) { this.uiConfig = config; }
  public exposeGetSchema() { return this.getSchema(); }
}

vi.mock('../../../src/lib/module-locator.js', () => ({
  ModuleLocator: {
    resolve: vi.fn(),
  },
}));

vi.mock('../../../src/engine/model-parser.js', () => ({
  ModelParser: {
    parse: vi.fn(),
  },
}));

describe('UiBaseBuilder - Exhaustive Coverage', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `ui-base-builder-exhaustive-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // Default mock implementation
    (ModuleLocator.resolve as any).mockImplementation((name: string) => {
      return { name, path: path.join(tmpDir, name), app: 'backend' };
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should throw in getSchema (lines 45-47)', () => {
    const builder = new TestUiBuilder('test', {} as any, tmpDir);
    expect(() => builder.exposeGetSchema()).toThrow('UiBaseBuilder subclasses often manage their own file generation loop');
  });

  describe('loadUiConfig', () => {
    it('should return if modulePath is missing (lines 51-53)', () => {
      const builder = new TestUiBuilder('test', {} as any, '');
      builder.exposeLoadUiConfig();
      // No config loaded
    });

    it('should warn if ui.yaml not found (lines 62-64)', () => {
      const builder = new TestUiBuilder('test', {} as any, tmpDir);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      builder.exposeLoadUiConfig();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ui.yaml NOT FOUND'));
      warnSpy.mockRestore();
    });

    it('should load valid ui.yaml (line 58)', () => {
      const builder = new TestUiBuilder('test', {} as any, tmpDir);
      fs.writeFileSync(path.join(tmpDir, 'ui.yaml'), 'backend: my-api\nprefix: test');
      builder.exposeLoadUiConfig();
      expect((builder as any).uiConfig.backend).toBe('my-api');
    });

    it('should warn on invalid ui.yaml (lines 59-61)', () => {
      const builder = new TestUiBuilder('test', {} as any, tmpDir);
      fs.writeFileSync(path.join(tmpDir, 'ui.yaml'), 'invalid: yaml: :');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      builder.exposeLoadUiConfig();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse ui.yaml'));
      warnSpy.mockRestore();
    });
  });

  describe('resolveModels', () => {
    it('should return empty if models.yaml not found (lines 72-74)', () => {
      const builder = new TestUiBuilder('test-ui', {} as any, tmpDir);
      const models = builder.exposeResolveModels();
      expect(models).toEqual([]);
    });

    it('should return parsed models (line 78)', () => {
      const builder = new TestUiBuilder('test-ui', {} as any, tmpDir);
      const backendPath = path.join(tmpDir, 'test-ui');
      fs.mkdirSync(backendPath, { recursive: true });
      fs.writeFileSync(path.join(backendPath, 'models.yaml'), 'dummy');
      
      (ModelParser.parse as any).mockReturnValue({ models: [{ name: 'User' }] } as any);
      
      const models = builder.exposeResolveModels();
      expect(models).toEqual([{ name: 'User' }]);
    });

    it('should return empty on parse error (lines 79-81)', () => {
      const builder = new TestUiBuilder('test-ui', {} as any, tmpDir);
      const backendPath = path.join(tmpDir, 'test-ui');
      fs.mkdirSync(backendPath, { recursive: true });
      fs.writeFileSync(path.join(backendPath, 'models.yaml'), 'dummy');
      
      (ModelParser.parse as any).mockImplementation(() => { throw new Error('Parse error'); });
      
      const models = builder.exposeResolveModels();
      expect(models).toEqual([]);
    });
  });

  describe('resolveRoutes', () => {
    it('should return empty if api.yaml not found (lines 89-91)', () => {
      const builder = new TestUiBuilder('test-ui', {} as any, tmpDir);
      const routes = builder.exposeResolveRoutes();
      expect(routes).toEqual([]);
    });

    it('should return parsed routes (lines 99-106)', () => {
      const builder = new TestUiBuilder('test-ui', {} as any, tmpDir);
      const backendPath = path.join(tmpDir, 'test-ui');
      fs.mkdirSync(backendPath, { recursive: true });
      fs.writeFileSync(path.join(backendPath, 'api.yaml'), 'User:\n  - path: /users\n    method: GET');
      
      const routes = builder.exposeResolveRoutes();
      expect(routes).toEqual([{ path: '/users', method: 'GET', modelName: 'User' }]);
    });

    it('should skip non-array routes (line 100)', () => {
      const builder = new TestUiBuilder('test-ui', {} as any, tmpDir);
      const backendPath = path.join(tmpDir, 'test-ui');
      fs.mkdirSync(backendPath, { recursive: true });
      fs.writeFileSync(path.join(backendPath, 'api.yaml'), 'User: not-an-array');
      
      const routes = builder.exposeResolveRoutes();
      expect(routes).toEqual([]);
    });

    it('should return empty on parse error (lines 107-109)', () => {
      const builder = new TestUiBuilder('test-ui', {} as any, tmpDir);
      const backendPath = path.join(tmpDir, 'test-ui');
      fs.mkdirSync(backendPath, { recursive: true });
      fs.writeFileSync(path.join(backendPath, 'api.yaml'), 'invalid: yaml: :');
      
      const routes = builder.exposeResolveRoutes();
      expect(routes).toEqual([]);
    });
  });

  describe('getModuleTypeName', () => {
    it('should return GlobalModuleTypes if no targetModule (line 114)', () => {
      const builder = new TestUiBuilder('', {} as any, tmpDir);
      builder.setUiConfig({ backend: '' });
      expect(builder.exposeGetModuleTypeName()).toBe('GlobalModuleTypes');
    });

    it('should handle -api suffix (lines 115-117)', () => {
      const builder = new TestUiBuilder('user-api', {} as any, tmpDir);
      expect(builder.exposeGetModuleTypeName()).toBe('UserModuleTypes');
    });

    it('should handle regular name (line 118)', () => {
      const builder = new TestUiBuilder('user', {} as any, tmpDir);
      expect(builder.exposeGetModuleTypeName()).toBe('UserModuleTypes');
    });
  });
});
