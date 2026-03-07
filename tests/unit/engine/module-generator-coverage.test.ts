import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModuleGenerator } from '../../../src/engine/module-generator.js';
import fs from 'node:fs';
import path from 'node:path';

// Mock Formatter and fs
const { mockFormat } = vi.hoisted(() => ({
  mockFormat: vi.fn((c) => c),
}));

vi.mock('../../../src/utils/formatter.js', () => ({
  Formatter: {
    format: mockFormat,
  },
}));

vi.mock('node:fs');

class TestGenerator extends ModuleGenerator {
  constructor(modulePath: string) {
    super(modulePath);
    // Replace the real project with a fully manual mock
    this.project = {
      getSourceFile: vi.fn(),
      removeSourceFile: vi.fn(),
      addSourceFileAtPath: vi.fn(),
      createSourceFile: vi.fn(),
      getSourceFiles: vi.fn().mockReturnValue([]),
    } as any;
  }
  async run() {
    // Mock runner
  }
}

describe('ModuleGenerator coverage', () => {
  let generator: TestGenerator;
  const baseDir = '/virtual-root';

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new TestGenerator(baseDir);
  });

  it('should create a new file if it does not exist in cache or disk', () => {
    const fileName = 'new.ts';
    (fs.existsSync as any).mockReturnValue(false);

    const mockFile = { getFilePath: () => '/virtual-root/new.ts' };
    (generator as any).project.createSourceFile.mockReturnValue(mockFile);

    const file = (generator as any).getOrCreateFile(fileName);
    expect(file).toBe(mockFile);
    expect((generator as any).project.createSourceFile).toHaveBeenCalled();
  });

  it('should load file from disk if not in cache', () => {
    const fileName = 'exists.ts';
    (fs.existsSync as any).mockImplementation((p: string) => {
      if (p === baseDir) return true; // dirname
      return true; // the file itself
    });

    const mockFile = { getFilePath: () => '/virtual-root/exists.ts' };
    (generator as any).project.addSourceFileAtPath.mockReturnValue(mockFile);

    const file = (generator as any).getOrCreateFile(fileName);
    expect(file).toBe(mockFile);
    expect((generator as any).project.addSourceFileAtPath).toHaveBeenCalled();
  });

  it('should handle cache eviction and reload', () => {
    const fileName = 'cached.ts';
    const absPath = path.join(baseDir, fileName);
    const mockFile = { getFilePath: () => absPath };

    // Mock getSourceFile for the initial check
    (generator as any).project.getSourceFile.mockReturnValue(mockFile);
    // DO NOT add to generatedFiles to trigger eviction

    (fs.existsSync as any).mockReturnValue(true);
    (generator as any).project.addSourceFileAtPath.mockReturnValue(mockFile);

    const file = (generator as any).getOrCreateFile(fileName);

    expect((generator as any).project.removeSourceFile).toHaveBeenCalledWith(mockFile);
    expect((generator as any).project.addSourceFileAtPath).toHaveBeenCalled();
    expect(file).toBe(mockFile);
  });

  it('should return file from "cache" while still performing fs checks', () => {
    const fileName = 'cached.ts';
    const absPath = path.join(baseDir, fileName);
    const mockFile = { getFilePath: () => absPath };

    (generator as any).project.getSourceFile.mockReturnValue(mockFile);
    (generator as any).generatedFiles.add(absPath);

    (fs.existsSync as any).mockReturnValue(true);
    (generator as any).project.addSourceFileAtPath.mockReturnValue(mockFile);

    const file = (generator as any).getOrCreateFile(fileName);

    // Implementation currently still reloads/recreates!
    expect((generator as any).project.addSourceFileAtPath).toHaveBeenCalled();
    expect(file).toBe(mockFile);
  });

  it('should save all files and create directories if missing', async () => {
    (fs.existsSync as any).mockReturnValue(false);

    const mockFile = {
      getFilePath: () => '/virtual-root/to-save.ts',
      getFullText: () => 'content',
      save: vi.fn(),
      wasForgotten: () => false,
    };
    (generator as any).project.getSourceFiles.mockReturnValue([mockFile]);
    (generator as any).project.createSourceFile.mockReturnValue(mockFile);

    (generator as any).getOrCreateFile('to-save.ts');
    await (generator as any).saveAll();

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should cleanup files matching pattern and containing header', () => {
    const genDir = path.join(baseDir, 'gen');
    const absGenDir = path.resolve(genDir);
    (fs.existsSync as any).mockImplementation((p: string) => p === absGenDir || p.endsWith('.ts'));
    (fs.readdirSync as any).mockReturnValue(['file1.ts', 'file2.js', 'manual.ts']);
    (fs.lstatSync as any).mockReturnValue({ isDirectory: () => false });
    (fs.readFileSync as any).mockImplementation((p: string) => {
      if (p.includes('file1.ts')) return '// GENERATED CODE - DO NOT MODIFY';
      return '// Manual code';
    });

    (generator as any).cleanup('gen', /\.ts$/);

    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('file1.ts'));
  });

  it('should skip cleanup if directory does not exist', () => {
    (fs.existsSync as any).mockReturnValue(false);
    (generator as any).cleanup('non-existent', /.*/);
    expect(fs.readdirSync).not.toHaveBeenCalled();
  });
});
