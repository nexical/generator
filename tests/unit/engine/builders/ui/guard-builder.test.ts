/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { GuardBuilder } from '../../../../../src/engine/builders/ui/guard-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('GuardBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should extract roles from pages and registries', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
pages:
  - path: '/admin'
    component: '@/components/AdminPage'
    guard: ['admin']
registries:
  nav-main:
    - name: 'user-link'
      priority: 10
      component: '@/components/nav/UserLink'
      guard: ['member']
      matcher: {}
`);

    const builder = new GuardBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    // Should generate generic RoleGuard
    expect(project.getSourceFile('src/components/guards/RoleGuard.tsx')).toBeDefined();

    // Should generate specific guards for each role
    expect(project.getSourceFile('src/components/guards/AdminGuard.tsx')).toBeDefined();
    expect(project.getSourceFile('src/components/guards/MemberGuard.tsx')).toBeDefined();
  });

  it('should generate generic RoleGuard', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
pages: []
registries: {}
`);

    const builder = new GuardBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    const sourceFile = project.getSourceFile('src/components/guards/RoleGuard.tsx');
    expect(sourceFile).toBeDefined();

    const text = sourceFile?.getFullText();
    expect(text).toContain('export const RoleGuard');
    expect(text).toContain('useAuth');
    expect(text).toContain('roles.some(role => user.roles.includes(role))');
  });

  it('should generate specific guard components', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
pages:
  - path: '/super-admin'
    component: '@/components/SuperAdminPage'
    guard: ['super-user']
`);

    const builder = new GuardBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    const sourceFile = project.getSourceFile('src/components/guards/SuperUserGuard.tsx');
    expect(sourceFile).toBeDefined();

    const text = sourceFile?.getFullText();
    expect(text).toContain('export const SuperUserGuard');
    expect(text).toContain('RoleGuard');
    expect(text).toContain("roles={['super-user']}");
  });

  it('should deduplicate roles across pages and registries', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
pages:
  - path: '/admin'
    component: '@/components/AdminPage'
    guard: ['admin']
  - path: '/admin/users'
    component: '@/components/AdminUsersPage'
    guard: ['admin']
registries:
  nav-main:
    - name: 'admin-link'
      priority: 10
      component: '@/components/nav/AdminLink'
      guard: ['admin']
      matcher: {}
`);

    const builder = new GuardBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    // Should only generate one AdminGuard despite multiple usages
    const files = project.getSourceFiles();
    const adminGuards = files.filter((f) => f.getBaseName() === 'AdminGuard.tsx');
    expect(adminGuards.length).toBe(1);
  });

  it('should handle empty guards', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
pages: []
registries: {}
`);

    const builder = new GuardBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    // Should still generate generic RoleGuard
    expect(project.getSourceFile('src/components/guards/RoleGuard.tsx')).toBeDefined();

    // Should not generate any specific guards
    const files = project.getSourceFiles();
    expect(files.length).toBe(1); // Only RoleGuard.tsx
  });
});
