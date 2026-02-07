/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseCommand } from '@nexical/generator/commands/base';

class TestCommand extends BaseCommand {
  constructor() {
    super({
      name: 'test',
      description: 'test description',
      args: { '<val>': 'some value' },
    });
  }
  async run(val: string): Promise<void> {
    if (val === 'fail') throw new Error('Simulated failure');
    if (val === 'string-fail') throw 'String error';
    console.info(`Ran with ${val}`);
  }
}

describe('BaseCommand', () => {
  let command: TestCommand;
  let originalExit: typeof process.exit;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    command = new TestCommand();
    originalExit = process.exit;
    originalEnv = { ...process.env };
    process.exit = vi.fn() as unknown as typeof process.exit;
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit = originalExit;
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should initialize with name and description', () => {
    const cmd = command.getCommand();
    expect(cmd.name()).toBe('test');
    expect(cmd.description()).toBe('test description');
  });

  it('should handle successful run via parseAsync', async () => {
    const cmd = command.getCommand();
    await cmd.parseAsync(['node', 'test.js', 'val']);
    expect(console.info).toHaveBeenCalledWith('Ran with val');
  });

  it('should handle command failure and log error', async () => {
    const cmd = command.getCommand();
    await cmd.parseAsync(['node', 'test.js', 'fail']);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should handle non-Error exceptions', async () => {
    const cmd = command.getCommand();
    await cmd.parseAsync(['node', 'test.js', 'string-fail']);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should show stack trace in debug mode', async () => {
    process.env['DEBUG'] = 'true';
    const cmd = command.getCommand();
    await cmd.parseAsync(['node', 'test.js', 'fail']);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
