/** @vitest-environment node */
/* eslint-disable */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModuleLocator } from '@nexical/generator/lib/module-locator';
import path from 'path';
import fs from 'fs-extra';
import { glob } from 'glob';

vi.mock('fs-extra');
vi.mock('glob', () => ({
  glob: Object.assign(vi.fn(), {
    hasMagic: (p: string) => p.includes('*') || p.includes('?'),
  }),
}));

describe('ModuleLocator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue('/test-project');
  });

  it('should find exact module if it exists as directory', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(true as never);
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

    const result = await ModuleLocator.expand('test-api');
    expect(result).toEqual(['test-api']);
  });

  it('should use glob if pattern has magic characters', async () => {
    vi.mocked(glob).mockResolvedValue(['mod1', 'mod2']);
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

    const result = await ModuleLocator.expand('*-api');
    expect(result).toEqual(['mod1', 'mod2']);
  });

  it('should filter out non-directories from glob matches', async () => {
    vi.mocked(glob).mockResolvedValue(['mod-dir', 'file.txt']);
    vi.mocked(fs.stat).mockImplementation(async (p: any) => {
      if (p.toString().includes('mod-dir')) return { isDirectory: () => true } as any;
      return { isDirectory: () => false } as any;
    });

    const result = await ModuleLocator.expand('*');
    expect(result).toEqual(['mod-dir']);
  });

  it('should handle trailing slashes in matches', async () => {
    vi.mocked(glob).mockResolvedValue(['mod-dir/']);
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

    const result = await ModuleLocator.expand('*');
    expect(result).toEqual(['mod-dir']);
  });
});
