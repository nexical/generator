import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PathResolver } from '@nexical/generator/utils/path-resolver.js';
import { loadConfig } from '@nexical/cli-core';
import path from 'node:path';

vi.mock('@nexical/cli-core', () => ({
  loadConfig: vi.fn(),
}));

describe('PathResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset private static config between tests using any if needed,
    // but better to just let it be since we can't easily reset private static without reflection
    // or adding a reset method.
    // For now, I'll assume we can re-init or just mock loadConfig differently.
    (PathResolver as any).config = null;
  });

  describe('init', () => {
    it('should load config only once', async () => {
      vi.mocked(loadConfig).mockResolvedValue({ modules: { paths: {} } });

      await PathResolver.init();
      await PathResolver.init();

      expect(loadConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolve', () => {
    it('should throw error if not initialized', () => {
      expect(() => PathResolver.resolve('test-module')).toThrow('PathResolver not initialized');
    });

    it('should resolve path based on regex pattern', async () => {
      vi.mocked(loadConfig).mockResolvedValue({
        modules: {
          paths: {
            'apps/api/modules': ['(.*)-api'],
            'apps/ui/modules': ['(.*)-ui'],
          },
        },
      });

      await PathResolver.init();

      const apiPath = PathResolver.resolve('user-api');
      expect(apiPath).toBe(path.join(process.cwd(), 'apps/api/modules', 'user-api'));

      const uiPath = PathResolver.resolve('user-ui');
      expect(uiPath).toBe(path.join(process.cwd(), 'apps/ui/modules', 'user-ui'));
    });

    it('should throw error if module cannot be resolved', async () => {
      vi.mocked(loadConfig).mockResolvedValue({
        modules: {
          paths: {
            'apps/api/modules': ['(.*)-api'],
          },
        },
      });

      await PathResolver.init();

      expect(() => PathResolver.resolve('unknown-module')).toThrow(
        'Could not resolve path for module',
      );
    });

    it('should handle missing paths configuration', async () => {
      vi.mocked(loadConfig).mockResolvedValue({});
      await PathResolver.init();
      expect(() => PathResolver.resolve('any-module')).toThrow();
    });
  });

  describe('getDefaults', () => {
    it('should return default roles when not configured', async () => {
      vi.mocked(loadConfig).mockResolvedValue({});
      await PathResolver.init();

      const defaults = PathResolver.getDefaults();
      expect(defaults.superRole).toBe('USER_ADMIN');
      expect(defaults.defaultRole).toBe('USER_EMPLOYEE');
    });

    it('should return configured roles', async () => {
      vi.mocked(loadConfig).mockResolvedValue({
        generator: {
          defaults: {
            superRole: 'CUSTOM_SUPER',
            defaultRole: 'CUSTOM_DEFAULT',
          },
        },
      });
      await PathResolver.init();

      const defaults = PathResolver.getDefaults();
      expect(defaults.superRole).toBe('CUSTOM_SUPER');
      expect(defaults.defaultRole).toBe('CUSTOM_DEFAULT');
    });
  });
});
