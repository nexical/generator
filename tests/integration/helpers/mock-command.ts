import { vi } from 'vitest';
import type { BaseCommand } from '@nexical/cli-core';

export interface MockCommand {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock BaseCommand that captures all log calls.
 * By default, `error()` throws so tests can assert on exit paths.
 */
export function createMockCommand(opts?: { errorThrows?: boolean }): MockCommand & BaseCommand {
  const errorThrows = opts?.errorThrows ?? true;
  return {
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn((msg: string) => {
      if (errorThrows) throw new Error(`CommandError: ${msg}`);
    }),
  } as unknown as MockCommand & BaseCommand;
}
