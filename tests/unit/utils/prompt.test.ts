import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPrompt } from '../../../src/utils/prompt.js';
import { PromptRunner } from '@nexical/ai';

vi.mock('@nexical/ai', () => ({
  PromptRunner: {
    run: vi.fn().mockResolvedValue(0),
  },
}));

describe('prompt utility', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.clearAllMocks();
  });

  it('should show help if no prompt name is provided', async () => {
    process.argv = ['node', 'prompt.js'];
    const code = await runPrompt();
    expect(code).toBe(0);
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  it('should show help if --help is provided', async () => {
    process.argv = ['node', 'prompt.js', '--help'];
    const code = await runPrompt();
    expect(code).toBe(0);
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  it('should run PromptRunner with default models if none provided', async () => {
    process.argv = ['node', 'prompt.js', 'my-prompt'];
    await runPrompt();
    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        promptName: 'my-prompt',
        models: ['gemini-3-flash-preview', 'gemini-3-pro-preview'],
      }),
    );
  });

  it('should parse aiConfig from argv', async () => {
    const aiConfig = { temperature: 0.5 };
    process.argv = ['node', 'prompt.js', 'my-prompt', '--aiConfig', JSON.stringify(aiConfig)];
    await runPrompt();
    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        aiConfig,
      }),
    );
  });

  it('should handle invalid aiConfig with warning', async () => {
    process.argv = ['node', 'prompt.js', 'my-prompt', '--aiConfig', '{invalid-json}'];
    await runPrompt();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse aiConfig'),
      expect.any(Error),
    );
  });

  it('should handle custom models list', async () => {
    process.argv = ['node', 'prompt.js', 'my-prompt', '--models', 'model1, model2'];
    await runPrompt();
    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        models: ['model1', 'model2'],
      }),
    );
  });

  it('should enable interactive mode from flag', async () => {
    process.argv = ['node', 'prompt.js', 'my-prompt', '--interactive'];
    await runPrompt();
    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        interactive: true,
      }),
    );
  });
});
