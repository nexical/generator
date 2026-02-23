import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { createMockCommand } from '../helpers/mock-command.js';

// Mock ModuleLocator for CLI handler tests
vi.mock('../../../src/lib/module-locator.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/lib/module-locator.js')>();
  return {
    ...original,
    ModuleLocator: {
      ...original.ModuleLocator,
      expand: vi.fn(),
      resolve: vi.fn().mockReturnValue({ name: 'widget-ui', path: '/mock', app: 'frontend' }),
    },
  };
});

// Mock UiModuleGenerator so the CLI handler tests don't rely on FormBuilder/real FS
vi.mock('../../../src/engine/ui-module-generator.js', () => ({
  UiModuleGenerator: vi.fn().mockImplementation(function () {
    return { run: vi.fn().mockResolvedValue(undefined) };
  }),
}));

import { ModuleLocator } from '../../../src/lib/module-locator.js';
import { UiModuleGenerator } from '../../../src/engine/ui-module-generator.js';
import { generateUiModule } from '../../../src/lib/generate-ui.js';

const MINIMAL_UI_YAML = `
pages:
  - path: /widgets
    component: WidgetList
    layout: DashboardLayout
registry:
  - zone: sidebar
    component: WidgetMenu
    order: 10
`;

describe('generate-ui Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexical-gen-ui-'));
    // Reset UiModuleGenerator mock to success by default
    vi.mocked(UiModuleGenerator).mockImplementation(function () {
      return { run: vi.fn().mockResolvedValue(undefined) } as unknown as UiModuleGenerator;
    });
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should call success when generate UI runs without errors', async () => {
    await fs.writeFile(path.join(tmpDir, 'ui.yaml'), MINIMAL_UI_YAML);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-ui', path: tmpDir, app: 'frontend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await generateUiModule(command, 'widget-ui');

    expect(command.success).toHaveBeenCalledWith(
      expect.stringContaining('Successfully generated UI code for "widget-ui"'),
    );
    expect(command.error).not.toHaveBeenCalled();
  });

  it('should call UiModuleGenerator with the correct module path', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-ui', path: tmpDir, app: 'frontend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await generateUiModule(command, 'widget-ui');

    expect(UiModuleGenerator).toHaveBeenCalledWith(tmpDir, expect.objectContaining({ command }));
  });

  it('should call command.error when UiModuleGenerator throws', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-ui', path: tmpDir, app: 'frontend' },
    ]);
    vi.mocked(UiModuleGenerator).mockImplementation(function () {
      return {
        run: vi.fn().mockRejectedValue(new Error('Generator crashed')),
      } as unknown as UiModuleGenerator;
    });

    const command = createMockCommand({ errorThrows: false });
    await generateUiModule(command, 'widget-ui');

    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('Generator crashed'));
    expect(command.success).not.toHaveBeenCalled();
  });

  it('should error when module directory does not exist', async () => {
    const nonExistentDir = path.join(tmpDir, 'does-not-exist');

    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    vi.mocked(ModuleLocator.resolve).mockReturnValue({
      name: 'missing-ui',
      path: nonExistentDir,
      app: 'frontend',
    });

    const command = createMockCommand({ errorThrows: false });
    await generateUiModule(command, 'missing-ui');

    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
  });

  it('should warn when glob matches no modules', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);

    const command = createMockCommand({ errorThrows: false });
    await generateUiModule(command, '*-ui');

    expect(command.warn).toHaveBeenCalledWith(
      expect.stringContaining('No modules found matching pattern "*-ui"'),
    );
  });

  it('should generate for multiple modules when pattern matches many', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'chat-ui', path: path.join(tmpDir, 'chat'), app: 'frontend' },
      { name: 'widget-ui', path: tmpDir, app: 'frontend' },
    ]);
    // Both dirs need to exist for the CLI handler fs.existsSync check
    await fs.ensureDir(path.join(tmpDir, 'chat'));

    const command = createMockCommand({ errorThrows: false });
    await generateUiModule(command, '*-ui');

    expect(UiModuleGenerator).toHaveBeenCalledTimes(2);
    expect(command.success).toHaveBeenCalledTimes(2);
  });

  it('should be idempotent: calling generator twice produces no side effects', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-ui', path: tmpDir, app: 'frontend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await generateUiModule(command, 'widget-ui');
    await generateUiModule(command, 'widget-ui');

    // UiModuleGenerator was instantiated twice (each `run` gets its own instance)
    expect(UiModuleGenerator).toHaveBeenCalledTimes(2);
    expect(command.success).toHaveBeenCalledTimes(2);
  });
});
