/* eslint-disable no-console */
/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPrompt } from '@nexical/generator/utils/prompt.js';
import { PromptRunner } from '@nexical/ai';

vi.mock('@nexical/ai', () => ({
  PromptRunner: {
    run: vi.fn(),
  },
}));

describe('runPrompt', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.clearAllMocks();
    process.argv = ['node', 'prompt.ts'];
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should show help if no prompt name is provided', async () => {
    const code = await runPrompt();
    expect(code).toBe(0);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  it('should show help if --help is provided', async () => {
    process.argv = ['node', 'prompt.ts', '--help'];
    const code = await runPrompt();
    expect(code).toBe(0);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
  });

  it('should run PromptRunner for a valid prompt', async () => {
    process.argv = ['node', 'prompt.ts', 'test-prompt', '--flag=value'];
    vi.mocked(PromptRunner.run).mockResolvedValue(0);

    const code = await runPrompt();

    expect(code).toBe(0);
    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        promptName: 'test-prompt',
        args: expect.objectContaining({ flag: 'value' }),
        models: ['gemini-3-flash-preview', 'gemini-3-pro-preview'],
        interactive: false,
      }),
    );
  });

  it('should parse aiConfig if provided', async () => {
    process.argv = ['node', 'prompt.ts', 'test-prompt', '--aiConfig={"model":"test"}'];
    vi.mocked(PromptRunner.run).mockResolvedValue(0);

    await runPrompt();

    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        aiConfig: { model: 'test' },
      }),
    );
  });

  it('should warn on invalid aiConfig', async () => {
    process.argv = ['node', 'prompt.ts', 'test-prompt', '--aiConfig=invalid'];
    vi.mocked(PromptRunner.run).mockResolvedValue(0);

    await runPrompt();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse aiConfig'),
      expect.any(Error),
    );
  });

  it('should use custom models if provided', async () => {
    process.argv = ['node', 'prompt.ts', 'test-prompt', '--models=model1,model2'];
    vi.mocked(PromptRunner.run).mockResolvedValue(0);

    await runPrompt();

    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        models: ['model1', 'model2'],
      }),
    );
  });

  it('should enable interactive mode if flag is set', async () => {
    process.argv = ['node', 'prompt.ts', 'test-prompt', '--interactive'];
    vi.mocked(PromptRunner.run).mockResolvedValue(0);

    await runPrompt();

    expect(PromptRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        interactive: true,
      }),
    );
  });
});
