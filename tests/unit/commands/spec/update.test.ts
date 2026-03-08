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
    vi.resetAllMocks();
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
    await command.run({ name: 'missing', interactive: false });
    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('No modules found'));
  });

  it('should create placeholder if SPECIFICATION.md missing (project)', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(false);
    await command.run({ name: 'project', interactive: false });
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('SPECIFICATION.md'),
      expect.stringContaining('Draft generated from code'),
    );
  });

  it('should warn if multiple modules found', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'm1', path: '/p1', app: 'backend' },
      { name: 'm2', path: '/p2', app: 'backend' },
    ]);
    vi.mocked(fs.pathExists).mockResolvedValue(true);
    await command.run({ name: 'm', interactive: false });
    expect(command.warn).toHaveBeenCalledWith(expect.stringContaining('Found 2 modules'));
  });

  it('should create placeholder if SPECIFICATION.md missing (module)', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'm1', path: '/p1', app: 'backend' },
    ]);
    vi.mocked(fs.pathExists).mockResolvedValue(false);
    await command.run({ name: 'm1', interactive: false });
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('should handle AgentRunner errors', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(true);
    vi.mocked(AgentRunner.run).mockRejectedValue(new Error('AI failed'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });

    await expect(command.run({ name: 'project', interactive: false })).rejects.toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('should use aiConfig from command config', async () => {
    (command as unknown as { config: unknown }).config = { generator: { ai: { model: 'gpt-4' } } };
    vi.mocked(fs.pathExists).mockResolvedValue(true);
    await command.run({ name: 'project', interactive: false });
    expect(AgentRunner.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ aiConfig: { model: 'gpt-4' } }),
      false,
    );
  });
});
