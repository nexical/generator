import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import { SpecUpdateCommand } from '@nexical/generator/commands/spec/update.js';
import { AgentRunner } from '@nexical/generator/utils/agent-runner.js';
import { ModuleLocator } from '@nexical/generator/lib/module-locator.js';

vi.mock('fs-extra');
vi.mock('@nexical/generator/utils/agent-runner.js');
vi.mock('@nexical/generator/lib/module-locator.js');

describe('SpecUpdateCommand', () => {
  let command: SpecUpdateCommand;
  const originalExit = process.exit;

  beforeEach(() => {
    command = new SpecUpdateCommand();
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

  describe('project spec update', () => {
    it('should handle project spec update (interactive)', async () => {
      vi.spyOn(fs, 'pathExists').mockResolvedValue(true as never);

      await command.run({ name: 'project', interactive: true });

      expect(AgentRunner.run).toHaveBeenCalledWith(
        'ProjectSpecWriter',
        'agents/project-spec-writer.md',
        expect.objectContaining({ user_input: expect.stringContaining('interview me') }),
        true,
      );
    });

    it('should handle project spec update (non-interactive)', async () => {
      vi.spyOn(fs, 'pathExists').mockResolvedValue(true as never);

      await command.run({ name: 'project', interactive: false });

      expect(AgentRunner.run).toHaveBeenCalledWith(
        'ProjectSpecWriter',
        'agents/project-spec-writer.md',
        expect.objectContaining({ user_input: expect.stringContaining('draft the specification') }),
        false,
      );
    });

    it('should create placeholder if project spec does not exist', async () => {
      vi.spyOn(fs, 'pathExists').mockResolvedValue(false);
      vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      await command.run({ name: 'project', interactive: false });

      expect(command.warn).toHaveBeenCalledWith(expect.stringContaining('not found'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('SPECIFICATION.md'),
        expect.any(String),
      );
    });

    it('should exit with 1 if AgentRunner fails', async () => {
      vi.spyOn(fs, 'pathExists').mockResolvedValue(true);
      vi.mocked(AgentRunner.run).mockRejectedValue(new Error('Agent Error'));

      await command.run({ name: 'project', interactive: false });

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('module spec update', () => {
    it('should update module spec (expand returns modules)', async () => {
      vi.mocked(ModuleLocator.expand).mockResolvedValue([
        { name: 'test-api', path: '/path/to/test-api', app: 'backend' },
      ]);
      vi.spyOn(fs, 'pathExists').mockResolvedValue(true);

      await command.run({ name: 'test-api', interactive: false });

      expect(AgentRunner.run).toHaveBeenCalledWith(
        'SpecWriter',
        'agents/module-spec-writer.md',
        expect.objectContaining({ module_root: '/path/to/test-api' }),
        false,
      );
    });

    it('should error if no modules found', async () => {
      vi.mocked(ModuleLocator.expand).mockResolvedValue([]);

      await command.run({ name: 'non-existent', interactive: false });

      expect(command.error).toHaveBeenCalledWith(
        expect.stringContaining('No modules found matching'),
      );
    });

    it('should warn and update first module if multiple found', async () => {
      vi.mocked(ModuleLocator.expand).mockResolvedValue([
        { name: 'test-api-1', path: '/path/to/1', app: 'backend' },
        { name: 'test-api-2', path: '/path/to/2', app: 'backend' },
      ]);
      vi.spyOn(fs, 'pathExists').mockResolvedValue(true);

      await command.run({ name: 'test-api-*', interactive: false });

      expect(command.warn).toHaveBeenCalledWith(expect.stringContaining('Found 2 modules'));
      expect(AgentRunner.run).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ module_root: '/path/to/1' }),
        expect.anything(),
      );
    });

    it('should create placeholder if module spec does not exist', async () => {
      vi.mocked(ModuleLocator.expand).mockResolvedValue([
        { name: 'test-api', path: '/path/to/test-api', app: 'backend' },
      ]);
      vi.spyOn(fs, 'pathExists').mockResolvedValue(false);
      vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      await command.run({ name: 'test-api', interactive: false });

      expect(command.warn).toHaveBeenCalledWith(
        expect.stringContaining('SPECIFICATION.md not found'),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('SPECIFICATION.md'),
        expect.any(String),
      );
    });

    it('should exit with 1 if AgentRunner fails for module', async () => {
      vi.mocked(ModuleLocator.expand).mockResolvedValue([
        { name: 'test-api', path: '/path/to/test-api', app: 'backend' },
      ]);
      vi.spyOn(fs, 'pathExists').mockResolvedValue(true);
      vi.mocked(AgentRunner.run).mockRejectedValue(new Error('Agent Error'));

      await command.run({ name: 'test-api', interactive: false });

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
