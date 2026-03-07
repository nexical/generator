import { describe, it, expect, beforeEach } from 'vitest';
import { UiBaseBuilder } from '../../../src/engine/builders/ui/ui-base-builder.js';
import path from 'node:path';
import * as fs from 'node:fs';
import os from 'node:os';

// Concrete implementation for testing
class TestUiBuilder extends UiBaseBuilder {
  constructor(moduleName: string, config: unknown, modulePath: string) {
    super(moduleName, config as import('../../../src/engine/types.js').ModuleConfig, modulePath);
  }

  async build(): Promise<void> {}

  public exposeLoadUiConfig() {
    return (this as unknown as { loadUiConfig: () => void }).loadUiConfig();
  }
  public exposeResolveModels() {
    return (this as unknown as { resolveModels: () => unknown[] }).resolveModels();
  }
  public exposeResolveRoutes() {
    return (this as unknown as { resolveRoutes: () => unknown[] }).resolveRoutes();
  }
  public exposeGetModuleTypeName() {
    return (this as unknown as { getModuleTypeName: () => string }).getModuleTypeName();
  }
}

describe('UiBaseBuilder', () => {
  let tmpDir: string;
  let modulePath: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `ui-base-builder-test-${Math.random().toString(36).slice(2)}`);
    modulePath = path.join(tmpDir, 'apps/frontend/modules/test-ui');
    fs.mkdirSync(modulePath, { recursive: true });
  });

  it('should handle missing modulePath in loadUiConfig', () => {
    const builder = new TestUiBuilder('test-ui', {}, '');
    (builder as unknown as { modulePath: string | undefined }).modulePath = undefined;
    builder.exposeLoadUiConfig();
    expect((builder as unknown as { uiConfig: Record<string, unknown> }).uiConfig).toEqual({});
  });

  it('should handle invalid ui.yaml in loadUiConfig', () => {
    fs.writeFileSync(path.join(modulePath, 'ui.yaml'), 'invalid: yaml: :');
    const builder = new TestUiBuilder('test-ui', {}, modulePath);
    builder.exposeLoadUiConfig();
    expect((builder as any).uiConfig).toEqual({});
  });

  it('should handle missing models.yaml in resolveModels', () => {
    const builder = new TestUiBuilder('test-ui', {}, modulePath);
    const models = builder.exposeResolveModels();
    expect(models).toEqual([]);
  });

  it('should handle missing api.yaml in resolveRoutes', () => {
    const builder = new TestUiBuilder('test-ui', {}, modulePath);
    const routes = builder.exposeResolveRoutes();
    expect(routes).toEqual([]);
  });

  it('should return default module type name when no backend is defined', () => {
    const builder = new TestUiBuilder('test-ui', {}, modulePath);
    expect(builder.exposeGetModuleTypeName()).toBe('TestUiModuleTypes');
  });

  it('should return GlobalModuleTypes if module name is missing', () => {
    const builder = new TestUiBuilder('', {}, modulePath);
    expect(builder.exposeGetModuleTypeName()).toBe('GlobalModuleTypes');
  });
});
