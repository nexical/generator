/** @vitest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenApiCommand from '@nexical/generator/commands/gen/api';
import { ModuleLocator } from '@nexical/generator/lib/module-locator';
import { ApiModuleGenerator } from '@nexical/generator/engine/api-module-generator';
import fs from 'fs-extra';

vi.mock('@nexical/generator/lib/module-locator', () => ({
  ModuleLocator: {
    expand: vi.fn(),
  },
}));
vi.mock('@nexical/generator/engine/api-module-generator', () => ({
  ApiModuleGenerator: vi.fn().mockImplementation(function () {
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

describe('GenApiCommand', () => {
  let command: GenApiCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    command = new GenApiCommand({} as any, {});
  });

  it('should generate code for found modules', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue(['test-api']);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await command.run({ name: 'test-api' });

    expect(ApiModuleGenerator).toHaveBeenCalled();
  });

  it('should scaffold a new module if it does not exist', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue(['new-api']);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await command.run({ name: 'new-api' });

    expect(fs.writeJSON).toHaveBeenCalled(); // package.json, etc.
  });

  it('should handle generation errors by re-throwing', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue(['test-api']);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    vi.mocked(ApiModuleGenerator).mockImplementationOnce(function () {
      return {
        run: vi.fn().mockRejectedValue(new Error('Generation failed')),
      } as unknown as ApiModuleGenerator;
    });

    vi.spyOn(command, 'error').mockImplementation((msg) => {
      throw new Error(String(msg));
    });

    await expect(command.run({ name: 'test-api' })).rejects.toThrow(
      'Failed to generate code: Generation failed',
    );
  });
});
