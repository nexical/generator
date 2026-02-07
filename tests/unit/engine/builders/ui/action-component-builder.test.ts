/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ActionComponentBuilder } from '../../../../../src/engine/builders/ui/action-component-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('ActionComponentBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should generate button component for custom actions', async () => {
    // Mock ui.yaml and api.yaml
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('ui.yaml')) return 'backend: "user-api"';
      if (p.includes('api.yaml')) {
        return `
User:
  - verb: POST
    path: /promote
    action: promoteUser
    summary: Promote user to admin
`;
      }
      return '';
    });

    const builder = new ActionComponentBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    const files = project.getSourceFiles();
    expect(files.length).toBeGreaterThan(0);
    // Debug path if needed
    // console.error(files.map(f => f.getFilePath()));

    const paths = files.map((f) => f.getFilePath());
    expect(paths.join(', ')).toContain('PromoteUserButton.tsx');

    // const sourceFile = files.find(f => f.getFilePath().includes('PromoteUserButton.tsx'));
    // expect(sourceFile).toBeDefined();
    // Skip sourceFile check if expect above handles it, but we need sourceFile for text check.
    const sourceFile = files.find((f) => f.getFilePath().includes('PromoteUserButton.tsx'));

    const text = sourceFile?.getFullText();
    expect(text).toContain('export const PromoteUserButton');
    expect(text).toContain('usePromoteUser');
    expect(text).toContain('mutation.mutate(payload');
    expect(text).toContain('Promote User'); // Derived label
  });
});
