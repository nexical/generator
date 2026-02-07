/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { AuthBuilder } from '../../../../../src/engine/builders/ui/auth-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('AuthBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should generate auth provider and hook', async () => {
    // Mock ui.yaml
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('');

    const builder = new AuthBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    const files = project.getSourceFiles();
    expect(files.length).toBeGreaterThan(0);

    const hook = files.find((f) => f.getFilePath().includes('use-auth.tsx'));
    expect(hook).toBeDefined();
    expect(hook?.getFullText()).toContain('export const useAuth');
    expect(hook?.getFullText()).toContain('createContext');

    const provider = files.find((f) => f.getFilePath().includes('AuthProvider.tsx'));
    expect(provider).toBeDefined();
    expect(provider?.getFullText()).toContain('AuthContext.Provider');
  });
});
