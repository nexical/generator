/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseCommand, type CommandDefinition } from '../../../src/lib/BaseCommand.js';
import { logger } from '../../../src/utils/logger.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

class TestCommand extends BaseCommand {
  static usage = 'test';
  static description = 'test description';
  static args: CommandDefinition = {
    args: [{ name: 'name', description: 'Name of test', required: false }],
  };

  async run(name: string) {
    if (name === 'error') throw new Error('Test Error');
    this.success(`Hello ${name}`);
  }
}

describe('BaseCommand', () => {
  let cmd: TestCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    cmd = new TestCommand();
  });

  it('should initialize correctly', () => {
    const internalCmd = (
      cmd as unknown as { getCommand: () => import('commander').Command }
    ).getCommand();
    expect(internalCmd.name()).toBe('test');
  });

  it('should handle log methods and empty messages', () => {
    cmd.success('Done');
    expect(logger.success).toHaveBeenCalledWith('Done');
    cmd.success('');

    cmd.info('Info');
    expect(logger.info).toHaveBeenCalledWith('Info');
    cmd.info('');
  });

  it('should handle errors in action handler', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Trigger action handler (approximate, since parseAsync matches internal command)
    await (cmd as unknown as { getCommand: () => import('commander').Command })
      .getCommand()
      .parseAsync(['node', 'test', 'error']);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Command failed:'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should handle object formatted options, args, and full help metadata', () => {
    class AdvancedCommand extends BaseCommand {
      async run() {}
    }
    const advanced = new AdvancedCommand({
      name: 'adv',
      description: 'advanced desc',
      args: { file: 'the file arg' },
      options: { '-f, --flag': 'the flag opt' },
      helpMetadata: {
        examples: ['adv my-run'],
        troubleshooting: ['restart standard flow'],
      },
    });

    advanced.warn('warn test');
    expect(logger.warn).toHaveBeenCalledWith('warn test');
    advanced.error('error test');
    expect(logger.error).toHaveBeenCalledWith('error test');

    const internalCmd = advanced.getCommand();
    const helpStr = internalCmd.helpInformation();

    expect(helpStr).toContain('Examples');
    expect(helpStr).toContain('adv my-run');
    expect(helpStr).toContain('Troubleshooting');
    expect(helpStr).toContain('restart standard flow');
  });
});
