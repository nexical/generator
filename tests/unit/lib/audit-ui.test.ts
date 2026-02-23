import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import fse from 'fs-extra';
import { auditUiModule } from '@nexical/generator/lib/audit-ui.js';
import { ModuleLocator } from '@nexical/generator/lib/module-locator.js';

vi.mock('fs-extra');
vi.mock('@nexical/generator/lib/module-locator.js');

describe('auditUiModule', () => {
  let mockCommand: { info: Mock; warn: Mock; error: Mock; success: Mock };

  beforeEach(() => {
    mockCommand = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should report warning if no modules found', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    await auditUiModule(mockCommand, 'test-ui', {});
    expect(mockCommand.warn).toHaveBeenCalledWith(
      expect.stringContaining('No modules found matching pattern'),
    );
  });

  it('should handle schema validation errors', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-ui', path: '/test' }]);
    vi.mocked(fse.existsSync).mockReturnValue(true);
    vi.mocked(fse.readFileSync).mockReturnValue('pages: [{ path: "invalid" }]'); // Missing component or registry

    await auditUiModule(mockCommand, 'test-ui', {});

    expect(mockCommand.info).toHaveBeenCalledWith(expect.stringContaining('Schema Error'));
  });

  it('should detect missing backend if linked', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-ui', path: '/test' }]);
    vi.mocked(fse.existsSync).mockImplementation(((p: unknown) => {
      if (typeof p === 'string' && p.endsWith('ui.yaml')) return true;
      return false; // everything else missing, including backend
    }) as unknown as typeof fse.existsSync);
    vi.mocked(fse.readFileSync).mockReturnValue('backend: my-api');

    await auditUiModule(mockCommand, 'test-ui', {});

    expect(mockCommand.info).toHaveBeenCalledWith(
      expect.stringContaining("Linked backend 'my-api' not found"),
    );
  });

  it('should detect missing generated roles/middleware if backend exists', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-ui', path: '/test' }]);
    vi.mocked(fse.existsSync).mockImplementation(((p: unknown) => {
      if (typeof p === 'string' && p.endsWith('ui.yaml')) return true;
      if (typeof p === 'string' && p.includes('backend/modules')) return true;
      return false; // roles/middleware missing
    }) as unknown as typeof fse.existsSync);
    vi.mocked(fse.readFileSync).mockReturnValue('backend: my-api');

    await auditUiModule(mockCommand, 'test-ui', {});

    expect(mockCommand.info).toHaveBeenCalledWith(
      expect.stringContaining('Missing generated file: src/roles/base-role.ts'),
    );
    expect(mockCommand.info).toHaveBeenCalledWith(
      expect.stringContaining('Missing generated file: src/middleware.ts'),
    );
  });

  it('should pass if everything is valid', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-ui', path: '/test' }]);
    vi.mocked(fse.existsSync).mockImplementation(((p: unknown) => {
      if (typeof p === 'string' && p.endsWith('ui.yaml')) return true;
      if (typeof p === 'string' && p.includes('backend/modules')) return true;
      if (typeof p === 'string' && p.includes('src/roles/base-role.ts')) return true;
      if (typeof p === 'string' && p.includes('src/middleware.ts')) return true;
      return false;
    }) as unknown as typeof fse.existsSync);
    vi.mocked(fse.readFileSync).mockReturnValue(
      'backend: my-api\nregistry: [{ component: "UserMenu", zone: "Zone1" }]',
    );

    await auditUiModule(mockCommand, 'test-ui', {});

    expect(mockCommand.success).toHaveBeenCalledWith(
      expect.stringContaining('Audit passed for all 1 modules.'),
    );
  });

  it('should Accumulate issues across multiple modules', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'ui-1', path: '/ui1' },
      { name: 'ui-2', path: '/ui2' },
    ]);
    vi.mocked(fse.existsSync).mockReturnValue(false); // Models missing for both

    await auditUiModule(mockCommand, 'all', {});

    expect(mockCommand.error).toHaveBeenCalledWith(
      expect.stringContaining('Audit failed with 2 issues'),
    );
  });
});
