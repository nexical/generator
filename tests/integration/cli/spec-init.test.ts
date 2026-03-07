import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { createMockCommand } from '../helpers/mock-command.js';
import { specInitModule } from '../../../src/lib/spec-init.js';

describe('spec-init Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexical-spec-init-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should initialize spec files for a new module', async () => {
    const modulePath = path.join(tmpDir, 'new-module');
    await fs.ensureDir(modulePath);

    const command = createMockCommand({ errorThrows: false });
    await specInitModule(command, modulePath, { type: 'api' });

    expect(fs.existsSync(path.join(modulePath, 'models.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(modulePath, 'api.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(modulePath, 'access.yaml'))).toBe(true);

    expect(command.success).toHaveBeenCalledWith(
      expect.stringContaining('Successfully initialized spec files'),
    );
  });

  it('should initialize spec files for a UI module', async () => {
    const modulePath = path.join(tmpDir, 'ui-module');
    await fs.ensureDir(modulePath);

    const command = createMockCommand({ errorThrows: false });
    await specInitModule(command, modulePath, { type: 'ui' });

    expect(fs.existsSync(path.join(modulePath, 'ui.yaml'))).toBe(true);
    // UI modules might not have models.yaml by default during init but often do
    expect(command.success).toHaveBeenCalled();
  });

  it('should fail if models.yaml already exists', async () => {
    const modulePath = path.join(tmpDir, 'existing-module');
    await fs.ensureDir(modulePath);
    await fs.writeFile(path.join(modulePath, 'models.yaml'), 'existing: content');

    const command = createMockCommand({ errorThrows: false });
    await specInitModule(command, modulePath, { type: 'api' });

    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });
});
