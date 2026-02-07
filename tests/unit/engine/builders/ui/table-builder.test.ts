/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { TableBuilder } from '../../../../../src/engine/builders/ui/table-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('TableBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should generate table component for models', async () => {
    // Mock ui.yaml and models
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'backend: "user-api"\ntables:\n  User: {}';
      if (String(path).endsWith('models.yaml')) {
        return `
models:
  User:
    api: true
    fields:
      id: { type: String }
      email: { type: String }
      role: { type: String }
`;
      }
      return '';
    });

    const builder = new TableBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    const sourceFile = project
      .getSourceFiles()
      .find((f) => f.getFilePath().endsWith('UserTable.tsx'));
    expect(sourceFile).toBeDefined();

    const text = sourceFile?.getFullText();
    expect(text).toContain('export function UserTable');
    expect(text).toContain('useUserQuery');
    expect(text).toContain('useDeleteUser');
    expect(text).toContain('email'); // Column
    expect(text).toContain('role'); // Column
    expect(text).toContain('deleteMutation.mutate(deletingItem.id)');
  });
});
