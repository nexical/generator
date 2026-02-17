/** @vitest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenUiCommand from '../../../src/commands/gen/ui';
import { ModuleLocator } from '../../../src/lib/module-locator';
import { UiModuleGenerator } from '../../../src/engine/ui-module-generator';
import fs from 'fs-extra';

vi.mock('../../../src/lib/module-locator', () => ({
  ModuleLocator: {
    expand: vi.fn(),
    resolve: vi.fn(),
  },
}));

vi.mock('../../../src/engine/ui-module-generator', () => ({
  UiModuleGenerator: vi.fn().mockImplementation(function () {
    return {
      run: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

vi.mock('fs-extra');
vi.mock('glob', () => ({
  glob: {
    hasMagic: vi.fn().mockReturnValue(false),
  },
}));

describe('GenUiCommand', () => {
  let command: GenUiCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    command = new GenUiCommand({} as any, {});
  });

  it('should generate code for found modules', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-ui', path: '/path/to/test-ui', app: 'frontend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await command.run({ name: 'test-ui' });

    expect(UiModuleGenerator).toHaveBeenCalled();
  });

  it('should attempt to generate for all modules when no name provided', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'mod1-ui', path: '/path/to/mod1-ui', app: 'frontend' },
      { name: 'mod2-ui', path: '/path/to/mod2-ui', app: 'frontend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await command.run({});

    expect(ModuleLocator.expand).toHaveBeenCalledWith('*-ui');
    expect(UiModuleGenerator).toHaveBeenCalledTimes(2);
  });

  it('should error if module does not exist and explicit name given', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    vi.mocked(ModuleLocator.resolve).mockReturnValue({
      name: 'missing-ui',
      path: '/path/to/missing-ui',
      app: 'frontend',
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);

    vi.spyOn(command, 'error').mockImplementation((msg) => {
      throw new Error(String(msg));
    });

    await expect(command.run({ name: 'missing-ui' })).rejects.toThrow(
      "Failed to generate UI code: Module directory '/path/to/missing-ui' does not exist.",
    );
  });
});
