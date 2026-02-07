/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { UiTestBuilder } from '../../../../../src/engine/builders/test/ui-test-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('UiTestBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should generate unit tests for components', async () => {
    // Mock ui.yaml and models.yaml
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('ui.yaml')) return 'backend: "user-api"';
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

    const builder = new UiTestBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    const files = project.getSourceFiles();
    expect(files.length).toBeGreaterThan(0);

    const tableTest = files.find((f) => f.getFilePath().includes('UserTable.test.tsx'));
    expect(tableTest).toBeDefined();
    expect(tableTest?.getFullText()).toContain("describe('UserTable',");
    expect(tableTest?.getFullText()).toContain('render(<UserTable />)');

    const formTest = files.find((f) => f.getFilePath().includes('UserForm.test.tsx'));
    expect(formTest).toBeDefined();
  });
});
