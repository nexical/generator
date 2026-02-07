/** @vitest-environment node */
/* eslint-disable */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModuleGenerator } from '@nexical/generator/engine/module-generator';
import fs from 'node:fs';
import path from 'node:path';
import { Formatter } from '@nexical/generator/utils/formatter';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    lstatSync: vi.fn(),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  lstatSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('@nexical/generator/utils/formatter');

class TestGenerator extends ModuleGenerator {
  async run() {}
  public testGetOrCreateFile(p: string) {
    return this.getOrCreateFile(p);
  }
  public testCleanup(d: string, p: RegExp) {
    return this.cleanup(d, p);
  }
  public async testSaveAll() {
    return this.saveAll();
  }
}

describe('ModuleGenerator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should create new files and handle cache eviction', () => {
    const generator = new TestGenerator('/tmp/module');

    vi.mocked(fs.existsSync).mockReturnValue(false);

    const file1 = generator.testGetOrCreateFile('test.ts');
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(file1.getFilePath()).toContain('test.ts');

    // Second call should NOT evict if in set
    const file2 = generator.testGetOrCreateFile('test.ts');
    expect(file1).toBe(file2);
  });

  it('should cleanup generated files based on pattern and header', () => {
    const generator = new TestGenerator('/tmp/module');

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['generated.ts', 'manual.ts'] as any);
    vi.mocked(fs.lstatSync).mockReturnValue({ isDirectory: () => false } as any);

    // Mock content for header check
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (p.toString().includes('generated.ts')) return '// GENERATED CODE - DO NOT MODIFY';
      return 'manual code';
    });

    generator.testCleanup('src', /\.ts$/);

    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('generated.ts'));
    expect(fs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining('manual.ts'));
  });

  it('should save project files and format them', async () => {
    const generator = new TestGenerator('/tmp/module');
    vi.mocked(Formatter.format).mockResolvedValue('formatted code');

    const file = generator.testGetOrCreateFile('save.ts');
    await generator.testSaveAll();

    expect(Formatter.format).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(file.getFilePath(), 'formatted code');
  });
});
