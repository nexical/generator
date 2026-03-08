import { describe, it, expect, vi, beforeEach } from 'vitest';
import { specInitModule } from '../../../src/lib/spec-init.js';
import { type BaseCommand } from '@nexical/cli-core';
import fs from 'node:fs';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

interface MockCommand {
  info: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

describe('specInitModule Unit', () => {
  let command: MockCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    command = {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as MockCommand;
  });

  it('should initialize api spec files', async () => {
    // 1st call: path exists check
    // subsequent calls: file exists check
    vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValue(false);

    await specInitModule(command as unknown as BaseCommand, '/test', { type: 'api' });

    expect(fs.writeFileSync).toHaveBeenCalledTimes(3);
    expect(command.success).toHaveBeenCalled();
  });

  it('should initialize ui spec', async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValue(false);
    await specInitModule(command as unknown as BaseCommand, '/test', { type: 'ui' });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('ui.yaml'),
      expect.anything(),
    );
  });

  it('should initialize agent spec', async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValue(false);
    await specInitModule(command as unknown as BaseCommand, '/test', { type: 'agent' });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('agent.yaml'),
      expect.anything(),
    );
  });

  it('should report path not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await specInitModule(command as unknown as BaseCommand, '/invalid', { type: 'api' });
    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('Path does not exist'));
  });

  it('should report file already exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    await specInitModule(command as unknown as BaseCommand, '/test', { type: 'api' });
    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('File already exists'));
  });
});
