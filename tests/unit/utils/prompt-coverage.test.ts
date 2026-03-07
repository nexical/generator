import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPrompt } from '../../../src/utils/prompt.js';
import { PromptRunner } from '@nexical/ai';

vi.mock('@nexical/ai', () => ({
  PromptRunner: {
    run: vi.fn().mockResolvedValue('test code'),
  },
}));

describe('prompt utility coverage', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should show help for -h flag', async () => {
    process.argv = ['node', 'prompt.js', '-h'];
    const result = await runPrompt();
    expect(result).toBe(0);
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  it('should show help for --help flag', async () => {
    process.argv = ['node', 'prompt.js', '--help'];
    const result = await runPrompt();
    expect(result).toBe(0);
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  it('should handle custom models with spaces and empty strings', async () => {
    process.argv = ['node', 'prompt.js', 'test', '--models', 'm1, ,m2,'];
    await runPrompt();
    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        models: ['m1', 'm2'],
      }),
    );
  });

  it('should use default models if none provided', async () => {
    process.argv = ['node', 'prompt.js', 'test'];
    await runPrompt();
    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        models: ['gemini-3-flash-preview', 'gemini-3-pro-preview'],
      }),
    );
  });

  it('should handle invalid aiConfig JSON', async () => {
    process.argv = ['node', 'prompt.js', 'test', '--aiConfig', '{invalid}'];
    await runPrompt();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse aiConfig'),
      expect.any(Error),
    );
  });

  it('should use provided aiConfig JSON', async () => {
    const config = { temp: 0.1 };
    process.argv = ['node', 'prompt.js', 'test', '--aiConfig', JSON.stringify(config)];
    await runPrompt();
    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        aiConfig: config,
      }),
    );
  });

  it('should return result from PromptRunner', async () => {
    process.argv = ['node', 'prompt.js', 'test'];
    const result = await runPrompt();
    expect(result).toBe('test code');
  });
});
