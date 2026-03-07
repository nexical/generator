import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TemplateLoader } from '../../../src/utils/template-loader.js';
import path from 'node:path';
import * as fs from 'node:fs';
import os from 'node:os';

describe('TemplateLoader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `template-loader-test-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    TemplateLoader.setModulePath(undefined);
  });

  it('should throw error on invalid template format', () => {
    const templatePath = path.join(tmpDir, 'invalid.tsf');
    fs.writeFileSync(templatePath, 'const x = 1;');

    // Mock internal templatesDir to point to tmpDir
    (TemplateLoader as unknown as { templatesDir: string }).templatesDir = tmpDir;

    expect(() => TemplateLoader.load('invalid.tsf')).toThrow('Invalid template format');
  });

  it('should correctly interpolate variables with regex special characters', () => {
    const templatePath = path.join(tmpDir, 'vars.tsf');
    fs.writeFileSync(templatePath, 'export default fragment`const ${key} = "${value}";`;');
    (TemplateLoader as unknown as { templatesDir: string }).templatesDir = tmpDir;

    const result = TemplateLoader.load('vars.tsf', { key: 'myVar', value: 'myValue' });
    expect(result.raw).toContain('const myVar = "myValue"');
  });

  it('should handle template overrides when activeModulePath is set', () => {
    const defaultDir = path.join(tmpDir, 'default');
    const moduleDir = path.join(tmpDir, 'module');
    fs.mkdirSync(defaultDir, { recursive: true });
    fs.mkdirSync(path.join(moduleDir, 'generator/templates'), { recursive: true });

    fs.writeFileSync(
      path.join(defaultDir, 'test.tsf'),
      'export default fragment`const version = "default";`;',
    );
    fs.writeFileSync(
      path.join(moduleDir, 'generator/templates', 'test.tsf'),
      'export default fragment`const version = "override";`;',
    );

    (TemplateLoader as unknown as { templatesDir: string }).templatesDir = defaultDir;
    TemplateLoader.setModulePath(moduleDir);

    const result = TemplateLoader.load('test.tsf');
    expect(result.raw).toContain('"override"');
  });

  it('should use tsx factory if extension is .txf', () => {
    const templatePath = path.join(tmpDir, 'test.txf');
    fs.writeFileSync(templatePath, 'export default fragment`<div>Hello</div>`;');
    (TemplateLoader as unknown as { templatesDir: string }).templatesDir = tmpDir;

    const result = TemplateLoader.load('test.txf');
    expect(result.raw).toContain('<div>Hello</div>');
  });

  it('should hit the cache', () => {
    const templatePath = path.join(tmpDir, 'cache.tsf');
    fs.writeFileSync(templatePath, 'export default fragment`const x = 1;`;');
    (TemplateLoader as unknown as { templatesDir: string }).templatesDir = tmpDir;

    const res1 = TemplateLoader.load('cache.tsf');
    const res2 = TemplateLoader.load('cache.tsf');
    expect(res2.raw).toBe(res1.raw);
  });
});
