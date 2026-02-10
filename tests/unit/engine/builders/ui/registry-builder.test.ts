/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { RegistryBuilder } from '../../../../../src/engine/builders/ui/registry-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('RegistryBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should generate registry files with correct naming', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
registries:
  nav-main:
    - name: 'user-link'
      priority: 10
      component: '@/components/nav/UserLink'
      guard: ['member']
      matcher:
        path: '/users/*'
`);

    const builder = new RegistryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const sourceFile = project.getSourceFile('src/registry/nav-main/10-user-link.tsx');
    expect(sourceFile).toBeDefined();

    const text = sourceFile?.getFullText();
    expect(text).toContain('export const RegistryItem');
    expect(text).toContain('UserLink');
  });

  it('should generate guard checks in registry items', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
registries:
  nav-main:
    - name: 'admin-link'
      priority: 20
      component: '@/components/nav/AdminLink'
      guard: ['admin', 'super-user']
      matcher:
        path: '/admin/*'
`);

    const builder = new RegistryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const sourceFile = project.getSourceFile('src/registry/nav-main/20-admin-link.tsx');
    const text = sourceFile?.getFullText();

    expect(text).toContain('useAuth');
    expect(text).toContain('Guard check');
    expect(text).toContain('["admin","super-user"]');
    expect(text).toContain('user.roles.includes(role)');
  });

  it('should generate matcher checks in registry items', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
registries:
  nav-main:
    - name: 'dashboard-link'
      priority: 5
      component: '@/components/nav/DashboardLink'
      guard: []
      matcher:
        path: '/dashboard/*'
`);

    const builder = new RegistryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const sourceFile = project.getSourceFile('src/registry/nav-main/5-dashboard-link.tsx');
    const text = sourceFile?.getFullText();

    expect(text).toContain('useShellContext');
    expect(text).toContain('Matcher check');
    expect(text).toContain("url.pathname.startsWith('/dashboard')");
  });

  it('should handle multiple zones', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
registries:
  nav-main:
    - name: 'main-link'
      priority: 10
      component: '@/components/nav/MainLink'
      guard: []
      matcher: {}
  footer:
    - name: 'footer-link'
      priority: 5
      component: '@/components/footer/FooterLink'
      guard: []
      matcher: {}
`);

    const builder = new RegistryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    expect(project.getSourceFile('src/registry/nav-main/10-main-link.tsx')).toBeDefined();
    expect(project.getSourceFile('src/registry/footer/5-footer-link.tsx')).toBeDefined();
  });

  it('should handle empty registries', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('registries: {}');

    const builder = new RegistryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const files = project.getSourceFiles();
    expect(files.length).toBe(0);
  });
});
