import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { createMockCommand } from '../helpers/mock-command.js';
import { specUpdateModule } from '../../../src/lib/spec-update.js';

describe('spec-update Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexical-spec-update-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should update models.yaml with new entities', async () => {
    const modulePath = path.join(tmpDir, 'existing-module');
    await fs.ensureDir(modulePath);
    await fs.writeFile(
      path.join(modulePath, 'models.yaml'),
      'Existing:\n  fields: { id: { type: String } }',
    );

    const command = createMockCommand({ errorThrows: false });
    // Simulate updating with a new model
    await specUpdateModule(command, modulePath, { add: 'NewModel' });

    const content = await fs.readFile(path.join(modulePath, 'models.yaml'), 'utf-8');
    expect(content).toContain('NewModel:');
    expect(content).toContain('Existing:');

    expect(command.success).toHaveBeenCalledWith(expect.stringContaining('Updated models.yaml'));
  });

  it('should update api.yaml with new routes', async () => {
    const modulePath = path.join(tmpDir, 'api-module');
    await fs.ensureDir(modulePath);
    await fs.writeFile(
      path.join(modulePath, 'api.yaml'),
      'Existing:\n  - path: /old\n    method: old',
    );

    const command = createMockCommand({ errorThrows: false });
    await specUpdateModule(command, modulePath, { route: 'NewModel:/new:GET' });

    const content = await fs.readFile(path.join(modulePath, 'api.yaml'), 'utf-8');
    expect(content).toContain('NewModel:');
    expect(content).toContain('path: /new');
    expect(command.success).toHaveBeenCalled();
  });

  it('should error if module path is invalid', async () => {
    const modulePath = path.join(tmpDir, 'non-existent');
    const command = createMockCommand({ errorThrows: false });
    await specUpdateModule(command, modulePath, {});

    expect(command.error).toHaveBeenCalled();
  });
});
