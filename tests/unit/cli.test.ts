/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

// Mock commander
const mockProgram = {
  version: vi.fn().mockReturnThis(),
  name: vi.fn().mockReturnThis(),
  description: vi.fn().mockReturnThis(),
  usage: vi.fn().mockReturnThis(),
  addCommand: vi.fn().mockReturnThis(),
  parseAsync: vi.fn().mockResolvedValue({}),
};

vi.mock('commander', () => ({
  program: mockProgram,
  Command: vi.fn().mockImplementation(function () {
    return mockProgram;
  }),
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  fileURLToPath: vi
    .fn()
    .mockReturnValue('/home/adrian/Projects/nexical/app-core/packages/generator/src/cli.ts'),
}));

// Mock dynamic commands
vi.mock('@nexical/generator/commands/gen/api', () => ({
  GenApiCommand: class {
    getCommand() {
      return { name: 'gen' };
    }
  },
}));
vi.mock('@nexical/generator/commands/audit/api', () => ({
  AuditApiCommand: class {
    getCommand() {
      return { name: 'audit' };
    }
  },
}));

describe('CLI (cli.ts)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register commands and parse args', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([]);

    const { main } = await import('@nexical/generator/cli');
    await main();

    expect(mockProgram.name).toHaveBeenCalledWith('arc');
    expect(mockProgram.parseAsync).toHaveBeenCalled();
  });

  it('should handle missing directory', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { main } = await import('@nexical/generator/cli');
    await main();
    expect(mockProgram.parseAsync).toHaveBeenCalled();
  });
});
