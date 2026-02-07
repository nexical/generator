/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Formatter } from '@nexical/generator/utils/formatter';
import prettier from 'prettier';
import { logger } from '@nexical/cli-core';

vi.mock('prettier', () => ({
  default: {
    resolveConfigFile: vi.fn(),
    resolveConfig: vi.fn(),
    format: vi.fn(),
  },
}));

vi.mock('@nexical/cli-core', () => ({
  BaseCommand: class {},
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Formatter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the static cache state specifically
    // @ts-expect-error - testing invalid assignment
    Formatter.hasCheckedConfig = false;
    // @ts-expect-error - testing invalid assignment
    Formatter.configCache = null;
  });

  it('should format code with resolved config', async () => {
    vi.mocked(prettier.resolveConfigFile).mockResolvedValue('/path/to/.prettierrc');
    vi.mocked(prettier.resolveConfig).mockResolvedValue({ semi: false });
    vi.mocked(prettier.format).mockResolvedValue('formatted content');

    const result = await Formatter.format('raw content', 'test.ts');

    expect(result).toBe('formatted content');
    expect(prettier.resolveConfigFile).toHaveBeenCalled();
    expect(prettier.resolveConfig).toHaveBeenCalledWith('/path/to/.prettierrc');
  });

  it('should infer parser from extension for various types', async () => {
    vi.mocked(prettier.format).mockImplementation(async (c, opt) => `parsed as ${opt?.parser}`);

    expect(await Formatter.format('', 'test.json')).toBe('parsed as json');
    expect(await Formatter.format('', 'test.css')).toBe('parsed as css');
    expect(await Formatter.format('', 'test.md')).toBe('parsed as markdown');
    expect(await Formatter.format('', 'test.yaml')).toBe('parsed as yaml');
    expect(await Formatter.format('', 'test.yml')).toBe('parsed as yaml');
    expect(await Formatter.format('', 'test.ts')).toBe('parsed as typescript');
  });

  it('should fallback to unformatted content on error', async () => {
    vi.mocked(prettier.format).mockRejectedValue(new Error('Formatting failed'));

    const result = await Formatter.format('raw content', 'error.ts');

    expect(result).toBe('raw content');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to format'));
  });

  it('should reuse config cache once loaded', async () => {
    // Clear mocks before this test to avoid carryover from previous tests in same file
    vi.mocked(prettier.resolveConfigFile).mockClear();
    vi.mocked(prettier.resolveConfigFile).mockResolvedValue(null);
    vi.mocked(prettier.format).mockResolvedValue('ok');

    // Reset state before this specific test case to be sure
    // @ts-expect-error - testing invalid assignment
    Formatter.hasCheckedConfig = false;

    await Formatter.format('c1', 'f1.ts');
    // @ts-expect-error - testing invalid assignment
    Formatter.hasCheckedConfig = true; // explicitly set it for the 2nd call to be absolutely sure
    await Formatter.format('c2', 'f2.ts');

    expect(prettier.resolveConfigFile).toHaveBeenCalledTimes(1);
  });
});
