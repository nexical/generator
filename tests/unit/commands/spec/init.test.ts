import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpecInitCommand from '@nexical/generator/commands/spec/init.js';
import { AgentRunner } from '@nexical/generator/utils/agent-runner.js';
import { ModuleLocator } from '@nexical/generator/lib/module-locator.js';
import fs from 'fs-extra';

vi.mock('@nexical/generator/utils/agent-runner.js', () => ({
  AgentRunner: {
    run: vi.fn(),
  },
}));

vi.mock('@nexical/generator/lib/module-locator.js', () => ({
  ModuleLocator: {
    resolve: vi.fn(),
  },
}));

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    writeFile: vi.fn(),
    ensureDir: vi.fn(),
  },
}));

describe('SpecInitCommand', () => {
  let command: SpecInitCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    command = new SpecInitCommand();
    vi.spyOn(command, 'info').mockImplementation(() => {});
    vi.spyOn(command, 'success').mockImplementation(() => {});
    vi.spyOn(command, 'warn').mockImplementation(() => {});
    vi.spyOn(command, 'error').mockImplementation(() => {});
  });

  it('should error if no name is provided', async () => {
    await command.run({ name: '' });
    expect(command.error).toHaveBeenCalledWith('Please provide a module name.');
  });

  it('should handle project init', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(false);
    await command.run({ name: 'project' });

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('SPECIFICATION.md'),
      expect.any(String),
    );
    expect(AgentRunner.run).toHaveBeenCalledWith(
      'ProjectSpecWriter',
      expect.any(String),
      expect.any(Object),
      true,
    );
  });

  it('should handle module init', async () => {
    vi.mocked(ModuleLocator.resolve).mockReturnValue({
      name: 'test-api',
      path: '/test',
      app: 'backend',
    });
    vi.mocked(fs.pathExists).mockResolvedValue(false);

    await command.run({ name: 'test-api' });

    expect(fs.ensureDir).toHaveBeenCalledWith('/test');
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('SPECIFICATION.md'),
      expect.any(String),
    );
    expect(AgentRunner.run).toHaveBeenCalledWith(
      'SpecWriter',
      expect.any(String),
      expect.any(Object),
      true,
    );
  });
});
