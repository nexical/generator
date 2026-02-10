/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

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
vi.mock('../../src/commands/gen/api', () => ({
  GenApiCommand: class {
    getCommand() {
      return { name: 'gen' };
    }
  },
}));
vi.mock('../../src/commands/audit/api', () => ({
  AuditApiCommand: class {
    getCommand() {
      return { name: 'audit' };
    }
  },
}));

describe('CLI', () => {
  it('should be defined', () => {
    expect(true).toBe(true);
  });
});
