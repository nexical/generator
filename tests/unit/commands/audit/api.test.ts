/** @vitest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AuditApiCommand from '../../../../src/commands/audit/api';
import { ModuleLocator } from '../../../../src/lib/module-locator';
import { ModelParser } from '../../../../src/engine/model-parser';
import YAML from 'yaml';
import fs from 'node:fs';
import path from 'path';
import { Project } from 'ts-morph';

// Mock ora globally for this file
vi.mock('ora', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      text: '',
    })),
  };
});

// ... (imports)
import * as AuditLib from '../../../../src/lib/audit-api';

// ... (mocks)

vi.mock('../../../../src/lib/audit-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/lib/audit-api')>();
  return {
    ...actual,
    auditApiModule: vi.fn(),
  };
});

describe('AuditApiCommand', () => {
  let command: AuditApiCommand;
  const mockModuleInfo = {
    name: 'test-api',
    path: path.join(process.cwd(), 'modules', 'test-api'), // Simulate path
    app: 'backend' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    command = new AuditApiCommand({ name: 'nexical' } as any, {});

    // Use spyOn for built-in fs to be more reliable
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([]);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle found modules in run loop', async () => {
    vi.spyOn(ModuleLocator, 'expand').mockResolvedValue([mockModuleInfo]);
    const auditMock = AuditLib.auditApiModule as unknown as ReturnType<typeof vi.fn>;
    auditMock.mockResolvedValue(undefined);

    await command.run({ name: 'test-api' });

    expect(AuditLib.auditApiModule).toHaveBeenCalled();
  });

  it('should handle no modules found', async () => {
    vi.spyOn(ModuleLocator, 'expand').mockResolvedValue([]);
    await command.run({ name: 'none-api*' });
  });

  describe('auditModule logic', () => {
    it('should report missing models.yaml', async () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
        if (String(p).includes('models.yaml')) return false;
        return true;
      });
      const issues = await AuditLib.auditModule(command, mockModuleInfo, false);
      expect(issues).toBeDefined();
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('models.yaml not found');
    });

    it('should handle audit exceptions gracefully', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readdirSync').mockReturnValue([]);
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
        if (String(p).includes('models.yaml')) throw new Error('Abort');
        return '';
      });

      const issues = await AuditLib.auditModule(command, mockModuleInfo, false);
      expect(issues[0]).toContain('Audit threw exception');
    });

    it('should perform full audit with code checks', async () => {
      // Setup path-aware existsSync to hit specific branches
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      vi.spyOn(fs, 'readdirSync').mockImplementation(((p: unknown) => {
        const pathStr = String(p);
        if (pathStr.includes('src/roles')) return ['admin.ts'];
        if (pathStr.endsWith('modules')) return ['test-api'];
        return [];
      }) as any);

      vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
        const pathStr = String(p);
        if (pathStr.includes('models.yaml'))
          return 'models: { User: { role: "admin", api: true } }';
        if (pathStr.includes('api.yaml')) return 'User: [{ path: "/me", method: "GET" }]';
        return '';
      });

      vi.spyOn(YAML, 'parse').mockImplementation((content: unknown) => {
        const contentStr = typeof content === 'string' ? content : '';
        if (contentStr.includes('models:'))
          return { models: { User: { role: 'admin', api: true } } };
        if (contentStr.includes('path:')) return { User: [{ path: '/me', method: 'GET' }] };
        return {};
      });

      vi.spyOn(ModelParser, 'parse').mockReturnValue({
        models: [
          {
            name: 'User',
            db: false,
            api: true,
            fields: {
              id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
            },
          },
        ],
        enums: [],
        config: {},
      } as any);

      // Mock Project and SourceFile
      const addFileSpy = vi.spyOn(Project.prototype, 'addSourceFileAtPath').mockReturnValue({
        getClass: () => undefined,
        getInterfaces: () => [],
        getEnums: () => [],
        getFunctions: () => [],
      } as any);

      const issues = await AuditLib.auditModule(command, mockModuleInfo, false);
      expect(issues).toBeDefined();
      expect(addFileSpy).toHaveBeenCalled();
    });

    it('should report semantic errors in models.yaml', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readdirSync').mockReturnValue([]);
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
        if (String(p).includes('models.yaml')) {
          return 'models: { User: { role: { a: "r" }, fields: { name: "Unknown" } } }';
        }
        return '';
      });
      vi.spyOn(YAML, 'parse').mockImplementation((content: unknown) => {
        const contentStr = typeof content === 'string' ? content : '';
        if (contentStr.includes('models:')) {
          return {
            models: { User: { role: { a: 'r' }, fields: { name: 'Unknown' } } },
          };
        }
        return {};
      });

      const issues: string[] = await AuditLib.auditModule(command, mockModuleInfo, true);

      expect(issues.some((i) => i.includes('unknown type'))).toBe(true);
      expect(issues.some((i) => i.includes('unknown role'))).toBe(true);
    });

    it('should validate db-enabled models', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readdirSync').mockReturnValue([]);
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
        if (String(p).includes('models.yaml')) {
          return 'models: { Post: { db: true, api: true, fields: { title: "String" } } }';
        }
        return '';
      });
      vi.spyOn(YAML, 'parse').mockImplementation((content: unknown) => {
        const contentStr = typeof content === 'string' ? content : '';
        if (contentStr.includes('Post')) {
          return {
            models: { Post: { db: true, api: true, fields: { title: 'String' } } },
          };
        }
        return {};
      });

      vi.spyOn(ModelParser, 'parse').mockReturnValue({
        models: [
          {
            name: 'Post',
            db: true,
            api: true,
            fields: {
              title: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
            },
          },
        ],
        enums: [],
        config: {},
      } as any);

      // Mock Project and SourceFile
      vi.spyOn(Project.prototype, 'addSourceFileAtPath').mockReturnValue({
        getClass: () => undefined,
        getInterfaces: () => [],
        getEnums: () => [],
        getFunctions: () => [],
      } as any);

      const issues = await AuditLib.auditModule(command, mockModuleInfo, false);
      expect(issues).toBeDefined();
    });
  });
});
