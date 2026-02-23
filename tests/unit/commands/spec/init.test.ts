import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import { SpecInitCommand } from '@nexical/generator/commands/spec/init.js';
import { AgentRunner } from '@nexical/generator/utils/agent-runner.js';
import { ModuleLocator } from '@nexical/generator/lib/module-locator.js';

vi.mock('fs-extra');
vi.mock('@nexical/generator/utils/agent-runner.js');
vi.mock('@nexical/generator/lib/module-locator.js');

describe('SpecInitCommand', () => {
  let command: SpecInitCommand;
  const originalExit = process.exit;

  beforeEach(() => {
    command = new SpecInitCommand();
    vi.spyOn(command, 'info').mockImplementation(() => {});
    vi.spyOn(command, 'warn').mockImplementation(() => {});
    vi.spyOn(command, 'error').mockImplementation(() => {});
    vi.spyOn(command, 'success').mockImplementation(() => {});
    // @ts-expect-error - mocking process.exit
    process.exit = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  it('should error if no name is provided', async () => {
    await command.run({});
    expect(command.error).toHaveBeenCalledWith('Please provide a module name.');
  });

  describe('project spec initialization', () => {
    it('should initialize project spec if name is "project"', async () => {
      vi.spyOn(fs, 'pathExists').mockResolvedValue(false);
      vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      await command.run({ name: 'project' });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('SPECIFICATION.md'),
        expect.stringContaining('# Project Specification'),
      );
      expect(AgentRunner.run).toHaveBeenCalledWith(
        'ProjectSpecWriter',
        'agents/project-spec-writer.md',
        expect.objectContaining({ spec_file: expect.stringContaining('SPECIFICATION.md') }),
        true,
      );
    });

    it('should warn if project SPECIFICATION.md already exists', async () => {
      vi.spyOn(fs, 'pathExists').mockResolvedValue(true);

      await command.run({ name: 'project' });

      expect(command.warn).toHaveBeenCalledWith(expect.stringContaining('already exists'));
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should exit with 1 if AgentRunner fails', async () => {
      vi.spyOn(fs, 'pathExists').mockResolvedValue(false);
      vi.mocked(AgentRunner.run).mockRejectedValue(new Error('Agent Error'));

      await command.run({ name: 'project' });

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('module spec initialization', () => {
    it('should initialize module spec if name is provided', async () => {
      vi.mocked(ModuleLocator.resolve).mockReturnValue({
        name: 'test-api',
        path: '/path/to/test-api',
        app: 'backend',
      });
      vi.spyOn(fs, 'pathExists').mockResolvedValue(false);
      vi.spyOn(fs, 'ensureDir').mockResolvedValue(undefined);
      vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      await command.run({ name: 'test-api' });

      expect(fs.ensureDir).toHaveBeenCalledWith('/path/to/test-api');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/path/to/test-api/SPECIFICATION.md'),
        expect.stringContaining('# Module Specification: test-api'),
      );
      expect(AgentRunner.run).toHaveBeenCalledWith(
        'SpecWriter',
        'agents/module-spec-writer.md',
        expect.objectContaining({ module_root: '/path/to/test-api' }),
        true,
      );
    });

    it('should warn if module already exists', async () => {
      vi.mocked(ModuleLocator.resolve).mockReturnValue({
        name: 'test-api',
        path: '/path/to/test-api',
        app: 'backend',
      });
      vi.spyOn(fs, 'pathExists').mockImplementation(async (p: string) => {
        if (p === '/path/to/test-api') return true;
        return false;
      });

      await command.run({ name: 'test-api' });

      expect(command.warn).toHaveBeenCalledWith(expect.stringContaining('already exists'));
      expect(fs.ensureDir).not.toHaveBeenCalled();
    });

    it('should not overwrite existing module SPECIFICATION.md', async () => {
      vi.mocked(ModuleLocator.resolve).mockReturnValue({
        name: 'test-api',
        path: '/path/to/test-api',
        app: 'backend',
      });
      vi.spyOn(fs, 'pathExists').mockResolvedValue(true);

      await command.run({ name: 'test-api' });

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should exit with 1 if AgentRunner fails for module', async () => {
      vi.mocked(ModuleLocator.resolve).mockReturnValue({
        name: 'test-api',
        path: '/path/to/test-api',
        app: 'backend',
      });
      vi.spyOn(fs, 'pathExists').mockResolvedValue(false);
      vi.mocked(AgentRunner.run).mockRejectedValue(new Error('Agent Error'));

      await command.run({ name: 'test-api' });

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('configuration handling', () => {
    it('should pick up aiConfig from generator config', async () => {
      vi.mocked(ModuleLocator.resolve).mockReturnValue({
        name: 'test-api',
        path: '/path/to/test-api',
        app: 'backend',
      });
      vi.spyOn(fs, 'pathExists').mockResolvedValue(false);

      const config = { generator: { ai: { model: 'gpt-4' } } };
      // @ts-expect-error - injecting config manually
      (command as unknown as { config: unknown }).config = config;

      await command.run({ name: 'test-api' });

      expect(AgentRunner.run).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ aiConfig: { model: 'gpt-4' } }),
        true,
      );
    });

    it('should pick up aiConfig from top-level ai config', async () => {
      vi.mocked(ModuleLocator.resolve).mockReturnValue({
        name: 'test-api',
        path: '/path/to/test-api',
        app: 'backend',
      });
      vi.spyOn(fs, 'pathExists').mockResolvedValue(false);

      const config = { ai: { model: 'claude-3' } };
      // @ts-expect-error - injecting config manually
      (command as unknown as { config: unknown }).config = config;

      await command.run({ name: 'test-api' });

      expect(AgentRunner.run).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ aiConfig: { model: 'claude-3' } }),
        true,
      );
    });
  });
});
