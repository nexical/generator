/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Project } from 'ts-morph';
import { StoryBuilder } from '@nexical/generator/engine/builders/test/unit/story-builder.js';
import * as fs from 'node:fs';
import { PathResolver } from '@nexical/generator/utils/path-resolver.js';

vi.mock('node:fs');
vi.mock('@nexical/generator/utils/path-resolver.js');

describe('StoryBuilder - Exhaustive Coverage', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
    vi.mocked(PathResolver.resolve).mockImplementation((name) => `/path/to/${name}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle missing ui.yaml', async () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => !String(path).endsWith('ui.yaml'));
    const builder = new StoryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should handle invalid ui.yaml', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'invalid: yaml: : content';
      return '';
    });
    const builder = new StoryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
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

    const builder = new StoryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
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

    const builder = new StoryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should generate stories for multiple models', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'prefix: "test"';
      if (String(path).endsWith('models.yaml'))
        return 'models: { M1: { fields: {} }, M2: { fields: {} } }';
      return '';
    });

    const builder = new StoryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    expect(project.getSourceFile('src/components/M1Table.stories.tsx')).toBeDefined();
    expect(project.getSourceFile('src/components/M1Form.stories.tsx')).toBeDefined();
    expect(project.getSourceFile('src/components/M2Table.stories.tsx')).toBeDefined();
    expect(project.getSourceFile('src/components/M2Form.stories.tsx')).toBeDefined();
  });
});
