import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRunner } from '../../../src/utils/agent-runner.js';
import * as childProcess from 'node:child_process';
import { logger } from '@nexical/cli-core';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
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

  it('should format arguments correctly including complex objects', () => {
    const aiConfig = { provider: 'openrouter', commandTemplate: 'test' };
    const args = {
      spec_file: 'some/path.md',
      aiConfig,
      simple: 'string_val',
    };

    AgentRunner.run('TestAgent', 'test/prompt.md', args);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('TestAgent working'));

    // execSync should be called with serialized aiConfig and proper flags
    expect(childProcess.execSync).toHaveBeenCalledWith(
      expect.stringContaining('--spec_file "some/path.md"'),
      expect.any(Object),
    );
    expect(childProcess.execSync).toHaveBeenCalledWith(
      expect.stringContaining(`--aiConfig '${JSON.stringify(aiConfig)}'`),
      expect.any(Object),
    );
    expect(childProcess.execSync).toHaveBeenCalledWith(
      expect.stringContaining('--simple "string_val"'),
      expect.any(Object),
    );
  });

  it('should throw an error if execution fails', () => {
    vi.mocked(childProcess.execSync).mockImplementationOnce(() => {
      throw new Error('Command failed');
    });

    expect(() => {
      AgentRunner.run('TestAgent', 'test/prompt.md', {});
    }).toThrow('Agent TestAgent failed execution: Command failed');
  });
});
