/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ShellBuilder } from '../../../../../src/engine/builders/ui/shell-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('ShellBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should register shells in src/init.ts', async () => {
    // Mock ui.yaml with shells configuration
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
shells:
  - name: 'admin-shell'
    matcher:
      path: '/admin/*'
      isMobile: false
`);

    const builder = new ShellBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const sourceFile = project.getSourceFile('src/init.ts');
    expect(sourceFile).toBeDefined();

    const text = sourceFile?.getFullText();
    expect(text).toContain('ShellRegistry.register');
    expect(text).toContain("'admin-shell'");
    expect(text).toContain('AdminShell');
    expect(text).toContain("ctx.url.pathname.startsWith('/admin')");
    expect(text).toContain('!ctx.isMobile');
  });

  it('should generate correct matcher for path wildcard', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
shells:
  - name: 'user-shell'
    matcher:
      path: '/users/*'
`);

    const builder = new ShellBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const sourceFile = project.getSourceFile('src/init.ts');
    const text = sourceFile?.getFullText();
    expect(text).toContain("ctx.url.pathname.startsWith('/users')");
  });

  it('should update existing registration', async () => {
    // Create init.ts with existing registration
    const initFile = project.createSourceFile(
      'src/init.ts',
      `import { ShellRegistry } from '@/lib/registries/shell-registry';
import { UserShell } from './components/shells/UserShell';

ShellRegistry.register('user-shell', UserShell, (ctx) => ctx.url.pathname === '/old-path');
`,
    );

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
shells:
  - name: 'user-shell'
    matcher:
      path: '/new-path/*'
`);

    const builder = new ShellBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, initFile);

    const text = initFile.getFullText();
    expect(text).toContain("ctx.url.pathname.startsWith('/new-path')");
    expect(text).not.toContain('/old-path');
  });

  it('should handle empty shells array', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('shells: []');

    const builder = new ShellBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const sourceFile = project.getSourceFile('src/init.ts');
    expect(sourceFile).toBeUndefined();
  });
});
