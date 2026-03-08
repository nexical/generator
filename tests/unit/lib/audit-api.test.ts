/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import * as fs from 'fs';

// Use dynamic import for auditModule
const auditModuleWrapper = async (
  cmd: unknown,
  info: import('../../../src/lib/module-locator.js').ModuleInfo,
  schemaOnly: boolean,
) => {
  const { auditModule } = await import('../../../src/lib/audit-api.js');
  return auditModule(cmd as unknown as import('@nexical/cli-core').BaseCommand, info, schemaOnly);
};

const auditApiModuleWrapper = async (cmd: unknown, name: string, options: { schema?: boolean }) => {
  const { auditApiModule } = await import('../../../src/lib/audit-api.js');
  return auditApiModule(cmd as unknown as import('@nexical/cli-core').BaseCommand, name, options);
};

vi.mock('fs');
vi.mock('../../../src/lib/module-locator.js', () => ({
  ModuleLocator: {
    expand: vi.fn(),
  },
}));

vi.mock('../../../src/engine/model-parser.js', () => ({
  ModelParser: {
    parse: vi.fn(),
  },
}));

const mockClass = {
  getMethods: vi.fn().mockReturnValue([]),
  getConstructors: vi.fn().mockReturnValue([]),
  getProperties: vi.fn().mockReturnValue([]),
  getConstructSignature: vi.fn(),
  addMethod: vi.fn(),
  addProperty: vi.fn(),
};

const mockInterface = {
  getProperties: vi.fn().mockReturnValue([]),
  addProperty: vi.fn(),
};

const mockFile = {
  getFunction: vi.fn(),
  getVariableStatement: vi.fn(),
  getClasses: vi.fn().mockReturnValue([mockClass]),
  getInterfaces: vi.fn().mockReturnValue([mockInterface]),
  getFunctions: vi.fn().mockReturnValue([]),
  getStatements: vi.fn().mockReturnValue([]),
  getClass: vi.fn().mockReturnValue(mockClass),
  getInterface: vi.fn().mockReturnValue(mockInterface),
};

const mockProject = {
  addSourceFileAtPath: vi.fn().mockReturnValue(mockFile),
};

vi.mock('ts-morph', () => {
  return {
    Project: vi.fn().mockImplementation(function () {
      return mockProject;
    }),
    SourceFile: vi.fn(),
  };
});

describe('auditApiModule', () => {
  let mockCommand: { info: Mock; warn: Mock; error: Mock; success: Mock };
  const mockModuleInfo = { name: 'test-api', path: '/test', app: 'backend' as const };

  beforeEach(() => {
    mockCommand = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    };
    vi.clearAllMocks();
    vi.spyOn(fs, 'readdirSync').mockImplementation(((p: string) => {
      if (p.includes('src/roles')) return ['global-role.ts'] as unknown as import('fs').Dirent[];
      if (p.includes('modules')) return ['test-module'] as unknown as import('fs').Dirent[];
      return [] as unknown as import('fs').Dirent[];
    }) as unknown as typeof fs.readdirSync);
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('models: {}');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should report Zod validation issues with correct path', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: { User: { features: 123 } }';
      return '';
    });

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes('User.features'))).toBe(true);
  });

  it('should report semantic issues for unknown types', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: { User: { fields: { age: "UnknownType" } } }';
      return '';
    });

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes('UnknownType'))).toBe(true);
  });

  it('should report semantic issues for unknown roles', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml'))
        return 'models: { User: { role: "admin", fields: { id: "String" } } }';
      return '';
    });
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes("Model 'User' has unknown role 'admin'"))).toBe(true);
  });

  it('should validate api.yaml semantics', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: { User: { fields: { id: "String" } } }';
      if (ps.endsWith('api.yaml'))
        return 'User: [{ path: "/custom", method: "post", input: "UnknownInput", output: "UnknownOutput", role: "unknown_role" }]';
      return '';
    });

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes('UnknownInput'))).toBe(true);
    expect(issues.some((i) => i.includes('UnknownOutput'))).toBe(true);
    expect(issues.some((i) => i.includes('unknown_role'))).toBe(true);
  });

  it('should perform full code audit via builders', async () => {
    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    (ModelParser.parse as Mock).mockReturnValue({
      models: [{ name: 'User', api: true, db: true, fields: {} }],
      enums: [],
    });

    vi.spyOn(fs, 'existsSync').mockImplementation(((p: import('fs').PathLike) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return true;
      if (ps.endsWith('api.yaml')) return true;
      return false;
    }) as unknown as typeof fs.existsSync);

    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: { User: { api: true, db: true } }';
      if (ps.endsWith('api.yaml'))
        return 'User: [{ path: "/foo", method: "post", action: "missingAction" }]';
      return '';
    });

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    expect(issues.some((i) => i.includes('[Missing]'))).toBe(true);
  });

  it('should handle missing models.yaml', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(
      ((p: import('fs').PathLike) =>
        !String(p).endsWith('models.yaml')) as unknown as typeof fs.existsSync,
    );
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues[0]).toContain('models.yaml not found');
  });

  it('should handle invalid YAML in models.yaml', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('invalid : yaml : {');
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues[0]).toContain('Failed to parse models.yaml');
  });

  it('should handle missing modules for auditApiModule', async () => {
    const { ModuleLocator } = await import('../../../src/lib/module-locator.js');
    (ModuleLocator.expand as Mock).mockResolvedValue([]);
    await auditApiModuleWrapper(mockCommand, 'non-existent', {});
    expect(mockCommand.warn).toHaveBeenCalledWith(expect.stringContaining('No modules found'));
  });
});
