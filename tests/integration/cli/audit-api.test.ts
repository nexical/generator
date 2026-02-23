import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { createMockCommand } from '../helpers/mock-command.js';

vi.mock('../../../src/lib/module-locator.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/lib/module-locator.js')>();
  return {
    ...original,
    ModuleLocator: {
      ...original.ModuleLocator,
      expand: vi.fn(),
    },
  };
});

import { ModuleLocator } from '../../../src/lib/module-locator.js';
import { auditApiModule } from '../../../src/lib/audit-api.js';
import { generateApiModule } from '../../../src/lib/generate-api.js';

const MINIMAL_MODELS_YAML = `
models:
  Widget:
    fields:
      id:
        type: String
        attributes:
          - "@id"
          - "@default(cuid())"
      name:
        type: String
      createdAt:
        type: DateTime
        attributes:
          - "@default(now())"
      updatedAt:
        type: DateTime
        attributes:
          - "@updatedAt"
`;

const INVALID_MODELS_YAML = `
models:
  Widget:
    badField: true
`;

describe('audit-api Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexical-audit-api-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should report no issues for a module with valid models.yaml (schema check)', async () => {
    // Seed the module with valid models.yaml
    await fs.writeFile(path.join(tmpDir, 'models.yaml'), MINIMAL_MODELS_YAML);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    // Use schema-only audit to avoid checking generated file existence
    await auditApiModule(command, 'widget-api', { schema: true });

    expect(command.success).toHaveBeenCalledWith(
      expect.stringContaining('Audit passed for all 1 modules.'),
    );
  });

  it('should report issue when models.yaml is missing', async () => {
    // No models.yaml in tmpDir
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await auditApiModule(command, 'widget-api', { schema: false });

    const errorCalls: string[] = vi.mocked(command.error).mock.calls.flat().map(String);
    expect(errorCalls.some((m) => m.includes('Audit failed'))).toBe(true);

    const infoCalls: string[] = vi.mocked(command.info).mock.calls.flat().map(String);
    expect(infoCalls.some((m) => m.includes('models.yaml not found at'))).toBe(true);
  });

  it('should report issue when models.yaml has invalid Zod schema', async () => {
    await fs.writeFile(path.join(tmpDir, 'models.yaml'), INVALID_MODELS_YAML);

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await auditApiModule(command, 'widget-api', { schema: true });

    const errorCalls: string[] = vi.mocked(command.error).mock.calls.flat().map(String);
    // Should either fail audit or report issues
    const infoCalls: string[] = vi.mocked(command.info).mock.calls.flat().map(String);

    // Either an error was thrown or issues were found
    const hasIssues = errorCalls.length > 0 || infoCalls.some((m) => m.includes('[widget-api]'));
    expect(hasIssues).toBe(true);
  });

  it('should pass schema-only audit with valid models.yaml', async () => {
    await fs.writeFile(path.join(tmpDir, 'models.yaml'), MINIMAL_MODELS_YAML);

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await auditApiModule(command, 'widget-api', { schema: true });

    expect(command.success).toHaveBeenCalledWith(
      expect.stringContaining('Audit passed for all 1 modules.'),
    );
  });

  it('should detect drift when service file is missing after generation', async () => {
    await fs.writeFile(path.join(tmpDir, 'models.yaml'), MINIMAL_MODELS_YAML);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    // Generate first
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);
    const genCommand = createMockCommand({ errorThrows: false });
    await generateApiModule(genCommand, 'widget-api');

    // Delete a generated file to simulate drift
    await fs.remove(path.join(tmpDir, 'src/services/widget-service.ts'));

    // Audit should now detect drift
    vi.clearAllMocks();
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await auditApiModule(command, 'widget-api', { schema: false });

    const errorCalls: string[] = vi.mocked(command.error).mock.calls.flat().map(String);
    const infoCalls: string[] = vi.mocked(command.info).mock.calls.flat().map(String);

    const hasDriftReport =
      errorCalls.some((m) => m.includes('Audit failed')) ||
      infoCalls.some((m) => m.includes('widget-service'));
    expect(hasDriftReport).toBe(true);
  });

  it('should warn when no modules match pattern', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);

    const command = createMockCommand({ errorThrows: false });
    await auditApiModule(command, '*-api', {});

    expect(command.warn).toHaveBeenCalledWith(
      expect.stringContaining('No modules found matching pattern "*-api"'),
    );
  });
});
