/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { PageObjectBuilder } from '../../../../../src/engine/builders/test/pom-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('PageObjectBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should generate POMs for models', async () => {
    // Mock ui.yaml and models.yaml
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('ui.yaml'))
        return 'backend: "user-api"\ntables:\n  User: {}\nforms:\n  User: {}';
      if (p.includes('models.yaml')) {
        return `
models:
  User:
    fields:
      name: string
`;
      }
      return '';
    });

    const builder = new PageObjectBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    const files = project.getSourceFiles();
    expect(files.length).toBeGreaterThan(0);

    const pom = files.find((f) => f.getFilePath().includes('UserPage.pom.ts'));
    expect(pom).toBeDefined();

    const text = pom?.getFullText();
    expect(text).toContain('class UserPage');
    expect(text).toContain("page.getByTestId('user-table')");
    expect(text).toContain("page.getByTestId('create-user-button')");
  });
});
