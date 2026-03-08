/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { RegistryBuilder } from '../../../../../src/engine/builders/ui/registry-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('RegistryBuilder - Exhaustive Coverage', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should handle missing registries in ui.yaml', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('backend: "user-api"\nPrefix: "test"'); // No registries key

    const builder = new RegistryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should cover all path matcher variants and complex matchers', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
registries:
  zone-p:
    - name: 'prefix-match'
      priority: 1
      component: '@/C1'
      matcher: { path: '/p/*' }
  zone-s:
    - name: 'suffix-match'
      priority: 2
      component: '@/C2'
      matcher: { path: '*.webp' }
  zone-w:
    - name: 'wildcard-match'
      priority: 3
      component: '@/C3'
      matcher: { path: '*' }
  zone-m:
    - name: 'complex-matcher'
      priority: 4
      component: '@/C4'
      matcher: 
        isMobile: true
        isTablet: false
        theme: 'dark'
`);

    const builder = new RegistryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const f1 = project.getSourceFile('src/registry/zone-p/1-prefix-match.tsx');
    expect(f1?.getFullText()).toContain("url.pathname.startsWith('/p')");

    const f2 = project.getSourceFile('src/registry/zone-s/2-suffix-match.tsx');
    expect(f2?.getFullText()).toContain("url.pathname.endsWith('.webp')");

    const f3 = project.getSourceFile('src/registry/zone-w/3-wildcard-match.tsx');
    expect(f3?.getFullText()).toContain('if (!(true))'); // Wildcard * matches everything

    const f4 = project.getSourceFile('src/registry/zone-m/4-complex-matcher.tsx');
    const text4 = f4?.getFullText();
    expect(text4).toContain("ctx.isMobile && !ctx.isTablet && ctx.theme === 'dark'");
  });

  it('should cover guards and exact path matching', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
registries:
  zone-g:
    - name: 'guard-test'
      priority: 1
      component: '@/G1'
      guard: ['admin']
      matcher: { path: '/exact' }
`);

    const builder = new RegistryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const f1 = project.getSourceFile('src/registry/zone-g/1-guard-test.tsx');
    const text = f1?.getFullText();
    expect(text).toContain('useAuth');
    expect(text).toContain('Guard check');
    expect(text).toContain('url.pathname === \'/exact\'');
  });

  it('should handle different component path depths', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
registries:
  z:
    - name: 'deep'
      priority: 1
      component: 'Comp'
    - name: 'deeper'
      priority: 2
      component: '@/a/b/c/DeeperComp'
`);

    const builder = new RegistryBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    expect(project.getSourceFile('src/registry/z/1-deep.tsx')?.getFullText()).toContain('<Comp />');
    expect(project.getSourceFile('src/registry/z/2-deeper.tsx')?.getFullText()).toContain('<DeeperComp />');
  });
});
