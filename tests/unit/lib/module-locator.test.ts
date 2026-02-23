import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModuleLocator } from '@nexical/generator/lib/module-locator.js';
import fs from 'fs-extra';
import { glob } from 'glob';

vi.mock('fs-extra');
vi.mock('glob', () => {
  const mGlob = vi.fn();
  (mGlob as unknown as { hasMagic: unknown }).hasMagic = vi.fn();
  return { glob: mGlob };
});

describe('ModuleLocator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('expand', () => {
    it('should expand direct module name', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as unknown as import('fs').Stats);
      vi.mocked(glob.hasMagic).mockReturnValue(false);

      const results = await ModuleLocator.expand('my-api');
      expect(results).toHaveLength(2); // One for backend, one for frontend if both mock true
      expect(results[0].name).toBe('my-api');
    });

    it('should expand with prefixes', async () => {
      vi.mocked(fs.pathExists).mockImplementation(async (p: unknown) =>
        String(p).includes('backend'),
      );
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as unknown as import('fs').Stats);
      vi.mocked(glob.hasMagic).mockReturnValue(false);

      const results = await ModuleLocator.expand('backend:my-api');
      expect(results).toHaveLength(1);
      expect(results[0].app).toBe('backend');
    });

    it('should expand frontend prefix', async () => {
      vi.mocked(fs.pathExists).mockImplementation(async (p: unknown) =>
        String(p).includes('frontend'),
      );
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as unknown as import('fs').Stats);
      vi.mocked(glob.hasMagic).mockReturnValue(false);

      const results = await ModuleLocator.expand('frontend:my-ui');
      expect(results).toHaveLength(1);
      expect(results[0].app).toBe('frontend');
    });

    it('should handle unknown prefixes', async () => {
      const results = await ModuleLocator.expand('unknown:my-api');
      expect(results).toHaveLength(0);
    });

    it('should expand globs', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(glob.hasMagic).mockReturnValue(true);
      // @ts-expect-error - testing glob expansion
      vi.mocked(glob).mockResolvedValue(['test-api'] as unknown as string[] & {
        [Symbol.iterator](): IterableIterator<string>;
      });
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as unknown as import('fs').Stats);

      const results = await ModuleLocator.expand('*-api');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('test-api');
    });

    it('should skip non-existent roots', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(false);
      const results = await ModuleLocator.expand('my-api');
      expect(results).toHaveLength(0);
    });

    it('should ignore direct match if not a directory', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
      } as unknown as import('fs').Stats);
      vi.mocked(glob.hasMagic).mockReturnValue(false);

      const results = await ModuleLocator.expand('my-api');
      expect(results).toHaveLength(0);
    });

    it('should ignore glob match if not a directory', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(glob.hasMagic).mockReturnValue(true);
      // @ts-expect-error - testing glob expansion
      vi.mocked(glob).mockResolvedValue(['file.txt'] as unknown as string[] & {
        [Symbol.iterator](): IterableIterator<string>;
      });
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
      } as unknown as import('fs').Stats);

      const results = await ModuleLocator.expand('*-api');
      expect(results).toHaveLength(0);
    });
  });

  describe('resolve', () => {
    it('should resolve backend by default', () => {
      vi.mocked(fs.pathExistsSync).mockReturnValue(true);
      const info = ModuleLocator.resolve('my-module');
      expect(info.app).toBe('backend');
      expect(info.path).toContain('apps/backend/modules');
    });

    it('should resolve frontend for -ui suffix', () => {
      vi.mocked(fs.pathExistsSync).mockReturnValue(true);
      const info = ModuleLocator.resolve('my-ui');
      expect(info.app).toBe('frontend');
      expect(info.path).toContain('apps/frontend/modules');
    });

    it('should resolve with prefix', () => {
      vi.mocked(fs.pathExistsSync).mockReturnValue(true);
      const info = ModuleLocator.resolve('frontend:my-module');
      expect(info.app).toBe('frontend');
    });

    it('should resolve backend for -email suffix', () => {
      vi.mocked(fs.pathExistsSync).mockReturnValue(true);
      const info = ModuleLocator.resolve('my-email');
      expect(info.app).toBe('backend');
    });
  });
});
