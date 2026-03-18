/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Project } from 'ts-morph';
import { PageObjectBuilder } from '@nexical/generator/engine/builders/test/unit/pom-builder.js';
import * as fs from 'node:fs';
import { ModuleLocator } from '@nexical/generator/lib/module-locator.js';

vi.mock('node:fs');

describe('PageObjectBuilder - Exhaustive Coverage', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle missing ui.yaml', async () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => !String(path).endsWith('ui.yaml'));
    const builder = new PageObjectBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should handle invalid ui.yaml', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'invalid: yaml: : content';
      return '';
    });
    const builder = new PageObjectBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should handle missing models.yaml', async () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return true;
      if (String(path).endsWith('models.yaml')) return false;
      return true;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('backend: "user-api"');

    // We need to mock ModuleLocator to return a path for user-api
    vi.spyOn(ModuleLocator, 'resolve').mockReturnValue({
      name: 'user-api',
      path: 'user-api',
      app: 'backend',
    } as unknown as import('@nexical/generator/lib/module-locator.js').ModuleInfo);

    const builder = new PageObjectBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should handle invalid models.yaml', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'backend: "user-api"';
      if (String(path).endsWith('models.yaml')) return 'invalid: yaml';
      return '';
    });
    vi.spyOn(ModuleLocator, 'resolve').mockReturnValue({
      name: 'user-api',
      path: 'user-api',
      app: 'backend',
    } as unknown as import('@nexical/generator/lib/module-locator.js').ModuleInfo);

    const builder = new PageObjectBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should use moduleName if backend is not specified in ui.yaml', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'prefix: "test"';
      if (String(path).endsWith('models.yaml')) return 'models: { M1: { fields: {} } }';
      return '';
    });
    vi.spyOn(ModuleLocator, 'resolve').mockReturnValue({
      name: 'test-ui',
      path: 'test-ui',
      app: 'frontend',
    } as unknown as import('@nexical/generator/lib/module-locator.js').ModuleInfo);

    const builder = new PageObjectBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    expect(project.getSourceFile('tests/e2e/pages/M1Page.pom.ts')).toBeDefined();
  });
});
