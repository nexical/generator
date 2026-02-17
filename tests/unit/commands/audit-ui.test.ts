/** @vitest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuditUiCommand from '../../../src/commands/audit/ui';
import { ModuleLocator } from '../../../src/lib/module-locator';
import fs from 'fs-extra';

vi.mock('../../../src/lib/module-locator', () => ({
  ModuleLocator: {
    expand: vi.fn(),
  },
}));

vi.mock('fs-extra');

describe('AuditUiCommand', () => {
  let command: AuditUiCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    command = new AuditUiCommand({} as any, {});
  });

  it('should audit found modules', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-ui', path: '/path/to/test-ui', app: 'frontend' },
    ]);
    vi.mocked(fs.existsSync).mockImplementation((p: string) => {
      // Mock ui.yaml existence
      if (p.endsWith('ui.yaml')) return true;
      // Mock backend module existence logic if needed, but for simple test:
      return true;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('backend: user-api\nprefix: /test\npages: []');

    // Spy on success
    const successSpy = vi.spyOn(command, 'success').mockImplementation(() => {});

    await command.run({ name: 'test-ui' });

    expect(successSpy).toHaveBeenCalledWith('Audit passed for all 1 modules.');
  });

  it('should report schema errors', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'bad-ui', path: '/path/to/bad-ui', app: 'frontend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // Invalid yaml (pages should be array)
    vi.mocked(fs.readFileSync).mockReturnValue('pages: "invalid-string"');

    // Spy on info/error
    const infoSpy = vi.spyOn(command, 'info').mockImplementation(() => {});
    vi.spyOn(command, 'error').mockImplementation(() => {});

    await command.run({ name: 'bad-ui' });

    // Should pass info messages about schema errors
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Schema Error'));
  });

  it('should report missing generated files', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-ui', path: '/path/to/test-ui', app: 'frontend' },
    ]);
    // Mock ui.yaml exists
    vi.mocked(fs.existsSync).mockImplementation((p: any) => p.endsWith('ui.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue('backend: user-api'); // Config with backend
    // But backend existence check / roles files return false (handled by strictly false default if not matched above)
    // Actually need to be careful with resolve/existsSync mocks.
    // path.resolve is not mocked, so it works. fs.existsSync needs to handle the resolved path.

    // Let's rely on the fact that fs.existsSync returns false by default for paths not matching 'ui.yaml' above?
    // Wait, mockImplementation default for vi.fn() is undefined/void? boolean?
    // vi.mocked(fs.existsSync) needs explicit return.

    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (typeof p === 'string' && p.endsWith('ui.yaml')) return true;
      // Mock backend modules dir existence to true so we proceed to check files?
      if (typeof p === 'string' && p.includes('backend/modules')) return true;

      // Return false for checks on middleware.ts or roles, triggering the error report
      return false;
    });

    const infoSpy = vi.spyOn(command, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(command, 'error').mockImplementation(() => {});

    await command.run({ name: 'test-ui' });

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Missing generated file'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Audit failed with 2 issues'));
  });
});
