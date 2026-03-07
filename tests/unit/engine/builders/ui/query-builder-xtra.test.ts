/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { QueryBuilder } from '../../../../../src/engine/builders/query-builder.js';
import { Project } from 'ts-morph';
import type { ModuleConfig } from '../../../../../src/engine/types.js';
import path from 'node:path';
import * as fs from 'node:fs';
import os from 'node:os';

describe('QueryBuilder - Enhanced Coverage', () => {
  let tmpDir: string;
  let modulePath: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `query-builder-cov-${Math.random().toString(36).slice(2)}`);
    modulePath = path.join(tmpDir, 'apps/frontend/modules/test-ui');
    fs.mkdirSync(path.join(modulePath, 'src/hooks'), { recursive: true });
    fs.writeFileSync(path.join(modulePath, 'ui.yaml'), 'api: true');
  });

  it('should handle models with no api actions gracefully', async () => {
    const builder = new QueryBuilder('test-ui', {} as unknown as ModuleConfig, modulePath);
    (builder as unknown as { uiConfig: unknown }).uiConfig = { api: true };
    // Mock resolveModels to return a non-api model - build should generate no hooks
    (builder as unknown as { resolveModels: () => unknown[] }).resolveModels = () => [
      { name: 'User', api: false, fields: {} },
    ];
    (builder as unknown as { resolveRoutes: () => unknown[] }).resolveRoutes = () => [];

    const project = new Project();
    const sourceFile = project.createSourceFile('dummy.ts', '');
    await builder.build(project, sourceFile);

    // No hooks should be created for non-api models
    const hookFiles = project.getSourceFiles().filter((f) => f.getFilePath().includes('/hooks/'));
    expect(hookFiles.length).toBe(0);
  });

  it('should generate hooks for api-exposed model', async () => {
    const builder = new QueryBuilder('test-ui', {} as unknown as ModuleConfig, modulePath);
    (builder as unknown as { uiConfig: unknown }).uiConfig = { api: true };
    (builder as unknown as { resolveModels: () => unknown[] }).resolveModels = () => [
      { name: 'User', api: true, fields: {} },
    ];
    (builder as unknown as { resolveRoutes: () => unknown[] }).resolveRoutes = () => [];

    const project = new Project();
    const sourceFile = project.createSourceFile('dummy.ts', '');
    await builder.build(project, sourceFile);

    const hookFiles = project
      .getSourceFiles()
      .filter((f) => f.getFilePath().includes('use-user.tsx'));
    expect(hookFiles.length).toBe(1);
  });
});
