/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { StoryBuilder } from '../../../../../src/engine/builders/test/story-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('StoryBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
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

    const builder = new StoryBuilder('test-ui', { name: 'test-ui' });
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
