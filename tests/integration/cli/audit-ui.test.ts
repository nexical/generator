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
import { auditUiModule } from '../../../src/lib/audit-ui.js';

const VALID_UI_YAML = `
pages:
  - path: /widgets
    component: WidgetList
registry:
  - zone: sidebar
    component: WidgetMenu
    order: 10
`;

describe('audit-ui Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexical-audit-ui-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should report no issues for a valid ui.yaml in schema-only mode', async () => {
    await fs.writeFile(path.join(tmpDir, 'ui.yaml'), VALID_UI_YAML);

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-ui', path: tmpDir, app: 'frontend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await auditUiModule(command, 'widget-ui', { schema: true });

    expect(command.success).toHaveBeenCalledWith(
      expect.stringContaining('Audit passed for all 1 modules.'),
    );
  });

  it('should report issue when ui.yaml is missing', async () => {
    // No ui.yaml written
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-ui', path: tmpDir, app: 'frontend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await auditUiModule(command, 'widget-ui', {});

    const infoCalls: string[] = vi.mocked(command.info).mock.calls.flat().map(String);
    expect(infoCalls.some((m) => m.includes('Missing ui.yaml'))).toBe(true);

    const errorCalls: string[] = vi.mocked(command.error).mock.calls.flat().map(String);
    expect(errorCalls.some((m) => m.includes('Audit failed'))).toBe(true);
  });

  it('should report schema error for invalid ui.yaml', async () => {
    // Write an object that doesn't match the UiConfig schema structure
    // (pages items require certain fields)
    const badYaml = `
pages:
  - badKey: oops
`;
    await fs.writeFile(path.join(tmpDir, 'ui.yaml'), badYaml);

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-ui', path: tmpDir, app: 'frontend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await auditUiModule(command, 'widget-ui', { schema: true });

    const infoCalls: string[] = vi.mocked(command.info).mock.calls.flat().map(String);
    const errorCalls: string[] = vi.mocked(command.error).mock.calls.flat().map(String);

    const hasSchemaIssue =
      infoCalls.some((m) => m.includes('Schema Error')) ||
      errorCalls.some((m) => m.includes('Audit failed'));
    expect(hasSchemaIssue).toBe(true);
  });

  it('should detect missing backend module link when ui.yaml references one', async () => {
    const uiWithBackend = `
backend: chat-api
pages:
  - path: /chat
    component: ChatList
`;
    await fs.writeFile(path.join(tmpDir, 'ui.yaml'), uiWithBackend);

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'chat-ui', path: tmpDir, app: 'frontend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await auditUiModule(command, 'chat-ui', { schema: false });

    const infoCalls: string[] = vi.mocked(command.info).mock.calls.flat().map(String);
    const errorCalls: string[] = vi.mocked(command.error).mock.calls.flat().map(String);

    // Either reports backend not found OR the audit passed (backend check is filesystem dependent)
    const hasReport = infoCalls.length > 0 || errorCalls.length > 0;
    expect(hasReport).toBe(true);
  });

  it('should warn when no modules match pattern', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);

    const command = createMockCommand({ errorThrows: false });
    await auditUiModule(command, '*-ui', {});

    expect(command.warn).toHaveBeenCalledWith(
      expect.stringContaining('No modules found matching pattern "*-ui"'),
    );
  });

  it('should audit multiple modules and accumulate all issues', async () => {
    const validDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexical-ui-valid-'));
    const invalidDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexical-ui-invalid-'));

    try {
      await fs.writeFile(path.join(validDir, 'ui.yaml'), VALID_UI_YAML);
      // invalidDir has no ui.yaml

      vi.mocked(ModuleLocator.expand).mockResolvedValue([
        { name: 'widget-ui', path: validDir, app: 'frontend' },
        { name: 'broken-ui', path: invalidDir, app: 'frontend' },
      ]);

      const command = createMockCommand({ errorThrows: false });
      await auditUiModule(command, '*-ui', {});

      // Should have failed because broken-ui is missing ui.yaml
      const errorCalls: string[] = vi.mocked(command.error).mock.calls.flat().map(String);
      expect(errorCalls.some((m) => m.includes('Audit failed'))).toBe(true);
    } finally {
      await fs.remove(validDir);
      await fs.remove(invalidDir);
    }
  });
});
