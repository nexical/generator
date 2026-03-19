/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { StoryBuilder } from '@nexical/generator/engine/builders/test/unit/story-builder.js';
import * as fs from 'node:fs';
import { PathResolver } from '@nexical/generator/utils/path-resolver.js';

vi.mock('node:fs');
vi.mock('@nexical/generator/utils/path-resolver.js');

describe('StoryBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
    vi.mocked(PathResolver.resolve).mockImplementation((name) => `/path/to/${name}`);
  });

  it('should generate stories for models', async () => {
    // Mock ui.yaml and models.yaml
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('ui.yaml')) return 'backend: "user-api"';
      if (p.includes('models.yaml')) {
        return `
models:
  User:
    api: true
    fields:
      name: string
`;
      }
      return '';
    });

    const builder = new StoryBuilder('test-ui', { name: 'test-ui' }, '/path/to/test-ui');
    await builder.build(project, undefined);

    const files = project.getSourceFiles();
    expect(files.length).toBeGreaterThan(0);

    const tableStory = files.find((f) => f.getFilePath().includes('UserTable.stories.tsx'));
    expect(tableStory).toBeDefined();
    expect(tableStory?.getFullText()).toContain("title: 'test-ui/UserTable'");

    const formStory = files.find((f) => f.getFilePath().includes('UserForm.stories.tsx'));
    expect(formStory).toBeDefined();
    expect(formStory?.getFullText()).toContain("title: 'test-ui/UserForm'");
  });
});
