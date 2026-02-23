import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRunner } from '../../../src/utils/agent-runner.js';
import { PromptRunner } from '@nexical/ai';
import { logger } from '@nexical/cli-core';

vi.mock('@nexical/ai', () => ({
  PromptRunner: {
    run: vi.fn(),
  },
}));

vi.mock('@nexical/cli-core', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AgentRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format arguments correctly including complex objects', async () => {
    const aiConfig = { provider: 'openrouter', commandTemplate: 'test' };
    const args = {
      spec_file: 'some/path.md',
      aiConfig,
      simple: 'string_val',
    };

    vi.mocked(PromptRunner.run).mockResolvedValue(0);

    await AgentRunner.run('TestAgent', 'test/prompt.md', args);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('TestAgent working'));

    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        promptName: 'test/prompt.md',
        aiConfig,
        args: expect.objectContaining({ simple: 'string_val', spec_file: 'some/path.md' }),
      }),
    );
  });

  it('should throw an error if execution fails (exit code !== 0)', async () => {
    vi.mocked(PromptRunner.run).mockResolvedValue(1);

    await expect(AgentRunner.run('TestAgent', 'test/prompt.md', {})).rejects.toThrow(
      'Agent TestAgent failed execution: Execution failed with code 1',
    );
  });

  it('should throw an error if PromptRunner throws', async () => {
    vi.mocked(PromptRunner.run).mockRejectedValue(new Error('Command failed'));

    await expect(AgentRunner.run('TestAgent', 'test/prompt.md', {})).rejects.toThrow(
      'Agent TestAgent failed execution: Command failed',
    );
  });

  it('should safely wrap thrown raw strings as errors', async () => {
    vi.mocked(PromptRunner.run).mockRejectedValue('String Error');

    await expect(AgentRunner.run('TestAgent', 'test/prompt.md', {})).rejects.toThrow(
      'Agent TestAgent failed execution: String Error',
    );
  });
});
