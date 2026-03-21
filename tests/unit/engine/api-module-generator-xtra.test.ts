import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiModuleGenerator } from '@nexical/generator/engine/api-module-generator.js';
import { Project } from 'ts-morph';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('ApiModuleGenerator Extra Coverage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexical-gen-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should cover runCoverageSweeper for agents, configs, and services', () => {
    // Setup minimal module structure
    const folders = ['src/agent', 'src/config', 'src/services', 'tests/unit/services'];
    folders.forEach((f) => fs.mkdirSync(path.join(tmpDir, f), { recursive: true }));

    // Create a dummy service
    fs.writeFileSync(
      path.join(tmpDir, 'src/services/user-service.ts'),
      'export class UserService { static init() {} list() {} }',
    );
    // Create a dummy models.yaml
    fs.writeFileSync(
      path.join(tmpDir, 'models.yaml'),
      'models:\n  User:\n    fields:\n      id: String',
    );
    // Create a dummy agent
    fs.writeFileSync(path.join(tmpDir, 'src/agent/my-agent.ts'), 'export class MyAgent {}');
    // Create a dummy config
    fs.writeFileSync(path.join(tmpDir, 'src/config/my-config.ts'), 'export const config = {}');
    // Create a dummy hook
    fs.mkdirSync(path.join(tmpDir, 'src/hooks'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src/hooks/use-data.ts'), 'export const useData = () => {}');

    // Create an existing test file with GENERATED CODE header to trigger that branch
    fs.mkdirSync(path.join(tmpDir, 'tests/unit/hooks'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'tests/unit/hooks/use-data.test.ts'),
      '// GENERATED CODE - DO NOT MODIFY\n',
    );

    const generator = new ApiModuleGenerator(tmpDir, {
      command: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as unknown as import('@nexical/cli-core').BaseCommand,
    });

    // @ts-expect-error - private method
    generator.runCoverageSweeper();

    // Verify that test files were requested in project
    const genProject = (generator as unknown as { project: Project }).project;
    const sourceFiles = genProject.getSourceFiles();
    const filePaths = sourceFiles.map((f) => f.getFilePath());

    expect(filePaths.some((p) => p.includes('tests/unit/services/user-service.test.ts'))).toBe(
      true,
    );
    expect(filePaths.some((p) => p.includes('tests/unit/agent/my-agent.test.ts'))).toBe(true);
    expect(filePaths.some((p) => p.includes('tests/unit/config/my-config.test.ts'))).toBe(true);
  });
});
