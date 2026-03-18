import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';

// Mock PromptRunner to avoid side effects during module evaluation
vi.mock('@nexical/ai', () => ({
  PromptRunner: {
    run: vi.fn().mockResolvedValue('module-evaluation-success'),
  },
}));

describe('prompt main block coverage', () => {
  it('should trigger the main block without unhandled process.exit', async () => {
    // 1. Simulate the environment
    const originalEnv = process.env.NODE_ENV;
    const originalArgv = [...process.argv];

    // 2. Mock process.exit to prevent Vitest from seeing it as an unhandled error
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (
        code?: string | number | null | undefined,
      ) => never);

    try {
      // 3. Set environment to non-test to enter the script guard
      process.env.NODE_ENV = 'production';

      // 4. Spoof the script path to match import.meta.url and provide a prompt name
      const promptPath = path.resolve(__dirname, '../../../src/utils/prompt.ts');
      process.argv = ['node', promptPath, 'dummy-prompt'];

      // 5. Dynamic import with cache-bust to force execution of the top-level block
      await import('@nexical/generator/utils/prompt.js?cachebust=' + Date.now());

      // 6. Verify it reached the exit call (which confirms it went through .then())
      expect(exitSpy).toHaveBeenCalled();
    } finally {
      // 7. Cleanup
      process.env.NODE_ENV = originalEnv;
      process.argv = originalArgv;
      exitSpy.mockRestore();
    }
  });

  it('should trigger the catch block on error', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalArgv = [...process.argv];
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (
        code?: string | number | null | undefined,
      ) => never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Force an error in the promise chain
    const { PromptRunner } = await import('@nexical/ai');
    vi.mocked(PromptRunner.run).mockRejectedValueOnce(new Error('Triggered Catch'));

    try {
      process.env.NODE_ENV = 'production';
      const promptPath = path.resolve(__dirname, '../../../src/utils/prompt.ts');
      process.argv = ['node', promptPath, 'dummy-prompt-error'];

      await import('@nexical/generator/utils/prompt.js?cachebust-error=' + Date.now());

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.argv = originalArgv;
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
