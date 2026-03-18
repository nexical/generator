import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { BuilderLoader } from '@nexical/generator/engine/builder-loader.js';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@nexical/cli-core';
import type { Project } from 'ts-morph';

vi.mock('@nexical/cli-core', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('BuilderLoader', () => {
  let projectMock: Project;
  const getOrCreateFileMock = vi.fn();

  const fixtureDir = path.join(__dirname, '__fixtures__', 'builder_loader_module');
  const buildersDir = path.join(fixtureDir, 'generator', 'builders');

  beforeAll(() => {
    fs.mkdirSync(buildersDir, { recursive: true });

    // 1. Valid builder
    fs.writeFileSync(
      path.join(buildersDir, 'valid-builder.ts'),
      `
      export default class ValidBuilder {
        async run(project, getOrCreateFile) {
          globalThis.__validBuilderRan = true;
        }
      }
      `,
    );

    // 2. Missing run method
    fs.writeFileSync(
      path.join(buildersDir, 'invalid-run-builder.ts'),
      `
      export default class InvalidRunBuilder {
      }
      `,
    );

    // 3. Missing default export class
    fs.writeFileSync(
      path.join(buildersDir, 'invalid-export-builder.ts'),
      `
      export class InvalidExportBuilder {
      }
      `,
    );

    // 4. Error on import
    fs.writeFileSync(
      path.join(buildersDir, 'error-builder.ts'),
      `
      throw new Error('Simulated Import error');
      `,
    );
  });

  afterAll(() => {
    fs.rmSync(path.join(__dirname, '__fixtures__'), { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    projectMock = {} as Project;
    globalThis.__validBuilderRan = false;
  });

  it('should return immediately if buildersDir does not exist', async () => {
    const nonExistentDir = path.join(__dirname, 'does_not_exist');
    await BuilderLoader.loadAndRun(
      nonExistentDir,
      projectMock,
      { moduleName: 'test', modulePath: nonExistentDir },
      getOrCreateFileMock,
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should process a valid builder correctly', async () => {
    // We will use a sub-folder to isolate tests?
    // Wait, glob('**/*.ts') will run ALL of them.
    // That means one call to loadAndRun will trigger all 4!
    // We can just call it once and assert all log messages.

    await BuilderLoader.loadAndRun(
      fixtureDir,
      projectMock,
      { moduleName: 'test', modulePath: fixtureDir },
      getOrCreateFileMock,
    );

    // Valid builder
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Running custom builder from valid-builder.ts'),
    );
    expect(globalThis.__validBuilderRan).toBe(true);

    // Invalid run builder
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Custom builder invalid-run-builder.ts does not have a 'run(project, getOrCreateFile)' method.",
      ),
    );

    // Invalid export builder
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('File invalid-export-builder.ts does not export a default class.'),
    );

    // Error builder
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load or run builder'),
      expect.stringContaining('Simulated Import error'),
    );
  });
});
