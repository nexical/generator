/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { RegistryBuilder } from '../../../../../src/engine/builders/ui/registry-builder.js';
import { Project } from 'ts-morph';
import type { ModuleConfig } from '../../../../../src/engine/types.js';
import path from 'node:path';
import * as fs from 'node:fs';
import os from 'node:os';

describe('RegistryBuilder - Enhanced Coverage', () => {
  let tmpDir: string;
  let modulePath: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `registry-builder-cov-${Math.random().toString(36).slice(2)}`);
    modulePath = path.join(tmpDir, 'apps/frontend/modules/test-ui');
    fs.mkdirSync(path.join(modulePath, 'src/registry'), { recursive: true });
  });

  it('should generate registry files in-memory for a single item', async () => {
    fs.writeFileSync(
      path.join(modulePath, 'ui.yaml'),
      `
registries:
  sidebar:
    - name: dashboard-link
      component: '@/components/DashboardLink'
      priority: 50
`,
    );
    const builder = new RegistryBuilder('test-ui', {} as unknown as ModuleConfig, modulePath);
    const project = new Project();

    await builder.build(project, undefined);

    // RegistryBuilder creates files in-memory in the Project (not disk)
    expect(project.getSourceFiles().length).toBeGreaterThan(0);
  });

  it('should generate registry files for multiple items in same zone', async () => {
    fs.writeFileSync(
      path.join(modulePath, 'ui.yaml'),
      `
registries:
  sidebar:
    - name: link-one
      component: '@/components/LinkOne'
      priority: 10
    - name: link-two
      component: '@/components/LinkTwo'
      priority: 20
`,
    );
    const builder = new RegistryBuilder('test-ui', {} as unknown as ModuleConfig, modulePath);
    const project = new Project();

    await builder.build(project, undefined);

    // Should have generated 2 files
    expect(project.getSourceFiles().length).toBe(2);
  });
});
