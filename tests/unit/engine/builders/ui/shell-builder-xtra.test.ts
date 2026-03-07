/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { ShellBuilder } from '../../../../../src/engine/builders/ui/shell-builder.js';
import { Project } from 'ts-morph';
import type { ModuleConfig } from '../../../../../src/engine/types.js';
import path from 'node:path';
import * as fs from 'node:fs';
import os from 'node:os';

describe('ShellBuilder - Enhanced Coverage', () => {
  let tmpDir: string;
  let modulePath: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `shell-builder-cov-${Math.random().toString(36).slice(2)}`);
    modulePath = path.join(tmpDir, 'apps/frontend/modules/test-ui');
    fs.mkdirSync(path.join(modulePath, 'src/shells'), { recursive: true });
  });

  it('should handle shells with empty configuration', async () => {
    fs.writeFileSync(path.join(modulePath, 'ui.yaml'), 'shells: []');
    const builder = new ShellBuilder('test-ui', {} as unknown as ModuleConfig, modulePath);
    const project = new Project();

    await builder.build(project, undefined);
    // No shells to register - should create no files
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should register shell in init.ts when shell configuration exists', async () => {
    fs.writeFileSync(
      path.join(modulePath, 'ui.yaml'),
      `
shells:
  - name: main
    matcher: {}
`,
    );
    const builder = new ShellBuilder('test-ui', {} as unknown as ModuleConfig, modulePath);
    const project = new Project();

    await builder.build(project, undefined);
    // ShellBuilder creates src/init.ts in-memory with ShellRegistry.register() calls
    const initFile = project.getSourceFile('src/init.ts');
    expect(initFile).toBeDefined();
    expect(initFile?.getFullText()).toContain('ShellRegistry.register');
  });
});
