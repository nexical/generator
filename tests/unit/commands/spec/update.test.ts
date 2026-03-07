import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpecUpdateCommand from '@nexical/generator/commands/spec/update.js';
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
    expand: vi.fn(),
  },
}));

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    writeFile: vi.fn(),
  },
}));

describe('SpecUpdateCommand', () => {
  let command: SpecUpdateCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    command = new SpecUpdateCommand();
    vi.spyOn(command, 'info').mockImplementation(() => {});
    vi.spyOn(command, 'success').mockImplementation(() => {});
    vi.spyOn(command, 'warn').mockImplementation(() => {});
    vi.spyOn(command, 'error').mockImplementation(() => {});
  });

  it('should error if no name is provided', async () => {
    await command.run({ name: '', interactive: false });
    expect(command.error).toHaveBeenCalledWith('Please provide a module name.');
  });

  it('should handle project update', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(true);
    await command.run({ name: 'project', interactive: true });

    expect(AgentRunner.run).toHaveBeenCalledWith(
      'ProjectSpecWriter',
      expect.any(String),
      expect.any(Object),
      true,
    );
  });

  it('should handle module update', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test', app: 'backend' },
    ]);
    vi.mocked(fs.pathExists).mockResolvedValue(true);

    await command.run({ name: 'test-api', interactive: false });

    expect(AgentRunner.run).toHaveBeenCalledWith(
      'SpecWriter',
      expect.any(String),
      expect.any(Object),
      false,
    );
  });

  it('should error if module not found', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    await command.run({ name: 'non-existent', interactive: false });
    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('No modules found'));
  });
});
