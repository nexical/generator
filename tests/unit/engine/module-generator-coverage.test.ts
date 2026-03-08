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

interface MockProject {
  getSourceFile: ReturnType<typeof vi.fn>;
  removeSourceFile: ReturnType<typeof vi.fn>;
  addSourceFileAtPath: ReturnType<typeof vi.fn>;
  createSourceFile: ReturnType<typeof vi.fn>;
  getSourceFiles: ReturnType<typeof vi.fn>;
}

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
    } as unknown as import('ts-morph').Project;
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
    (fs.existsSync as unknown as { mockReturnValue(v: boolean): void }).mockReturnValue(false);

    const mockFile = { getFilePath: () => '/virtual-root/new.ts' };
    (generator as unknown as { project: MockProject }).project.createSourceFile.mockReturnValue(
      mockFile,
    );

    const file = (generator as unknown as { getOrCreateFile(n: string): unknown }).getOrCreateFile(
      fileName,
    );
    expect(file).toBe(mockFile);
    expect(
      (generator as unknown as { project: MockProject }).project.createSourceFile,
    ).toHaveBeenCalled();
  });

  it('should load file from disk if not in cache', () => {
    const fileName = 'exists.ts';
    (fs.existsSync as unknown as { mockImplementation(fn: unknown): void }).mockImplementation(
      (p: string) => {
        if (p === baseDir) return true; // dirname
        return true; // the file itself
      },
    );

    const mockFile = { getFilePath: () => '/virtual-root/exists.ts' };
    (generator as unknown as { project: MockProject }).project.addSourceFileAtPath.mockReturnValue(
      mockFile,
    );

    const file = (generator as unknown as { getOrCreateFile(n: string): unknown }).getOrCreateFile(
      fileName,
    );
    expect(file).toBe(mockFile);
    expect(
      (generator as unknown as { project: MockProject }).project.addSourceFileAtPath,
    ).toHaveBeenCalled();
  });

  it('should handle cache eviction and reload', () => {
    const fileName = 'cached.ts';
    const absPath = path.join(baseDir, fileName);
    const mockFile = { getFilePath: () => absPath };

    // Mock getSourceFile for the initial check
    (generator as unknown as { project: MockProject }).project.getSourceFile.mockReturnValue(
      mockFile,
    );
    // DO NOT add to generatedFiles to trigger eviction

    (fs.existsSync as unknown as { mockReturnValue(v: boolean): void }).mockReturnValue(true);
    (generator as unknown as { project: MockProject }).project.addSourceFileAtPath.mockReturnValue(
      mockFile,
    );

    const file = (generator as unknown as { getOrCreateFile(n: string): unknown }).getOrCreateFile(
      fileName,
    );

    expect(
      (generator as unknown as { project: MockProject }).project.removeSourceFile,
    ).toHaveBeenCalledWith(mockFile);
    expect(
      (generator as unknown as { project: MockProject }).project.addSourceFileAtPath,
    ).toHaveBeenCalled();
    expect(file).toBe(mockFile);
  });

  it('should return file from "cache" while still performing fs checks', () => {
    const fileName = 'cached.ts';
    const absPath = path.join(baseDir, fileName);
    const mockFile = { getFilePath: () => absPath };

    (generator as unknown as { project: MockProject }).project.getSourceFile.mockReturnValue(
      mockFile,
    );
    (generator as unknown as { generatedFiles: Set<string> }).generatedFiles.add(absPath);

    (fs.existsSync as unknown as { mockReturnValue(v: boolean): void }).mockReturnValue(true);
    (generator as unknown as { project: MockProject }).project.addSourceFileAtPath.mockReturnValue(
      mockFile,
    );

    const file = (generator as unknown as { getOrCreateFile(n: string): unknown }).getOrCreateFile(
      fileName,
    );

    // Implementation currently still reloads/recreates!
    expect(
      (generator as unknown as { project: MockProject }).project.addSourceFileAtPath,
    ).toHaveBeenCalled();
    expect(file).toBe(mockFile);
  });

  it('should save all files and create directories if missing', async () => {
    (fs.existsSync as unknown as { mockReturnValue(v: boolean): void }).mockReturnValue(false);

    const mockFile = {
      getFilePath: () => '/virtual-root/to-save.ts',
      getFullText: () => 'content',
      save: vi.fn(),
      wasForgotten: () => false,
    };
    (generator as unknown as { project: MockProject }).project.getSourceFiles.mockReturnValue([
      mockFile,
    ]);
    (generator as unknown as { project: MockProject }).project.createSourceFile.mockReturnValue(
      mockFile,
    );

    (generator as unknown as { getOrCreateFile(n: string): unknown }).getOrCreateFile('to-save.ts');
    await (generator as unknown as { saveAll(): Promise<void> }).saveAll();

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should cleanup files matching pattern and containing header', () => {
    const genDir = path.join(baseDir, 'gen');
    const absGenDir = path.resolve(genDir);
    (fs.existsSync as unknown as { mockImplementation(fn: unknown): void }).mockImplementation(
      (p: string) => p === absGenDir || p.endsWith('.ts'),
    );
    (fs.readdirSync as unknown as { mockReturnValue(v: string[]): void }).mockReturnValue([
      'file1.ts',
      'file2.js',
      'manual.ts',
    ]);
    (fs.lstatSync as unknown as { mockReturnValue(v: unknown): void }).mockReturnValue({
      isDirectory: () => false,
    });
    (fs.readFileSync as unknown as { mockImplementation(fn: unknown): void }).mockImplementation(
      (p: string) => {
        if (p.includes('file1.ts')) return '// GENERATED CODE - DO NOT MODIFY';
        return '// Manual code';
      },
    );

    (generator as unknown as { cleanup(p: string, r: RegExp): void }).cleanup('gen', /\.ts$/);

    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('file1.ts'));
  });

  it('should skip cleanup if directory does not exist', () => {
    (fs.existsSync as unknown as { mockReturnValue(v: boolean): void }).mockReturnValue(false);
    (generator as unknown as { cleanup(p: string, r: RegExp): void }).cleanup('non-existent', /.*/);
    expect(fs.readdirSync).not.toHaveBeenCalled();
  });
});
