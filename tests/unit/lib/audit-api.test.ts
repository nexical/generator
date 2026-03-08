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

vi.mock('../../../src/engine/builders/base-builder.js', () => ({
  BaseBuilder: class {
    validate() {
      return { valid: true, issues: [] };
    }
  },
}));

describe('auditApiModule', () => {
  let mockCommand: { info: Mock; warn: Mock; error: Mock; success: Mock };
  const mockModuleInfo = { name: 'test-api', path: '/test', app: 'backend' as const };

  beforeEach(async () => {
    mockCommand = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    };
    vi.clearAllMocks();
    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    (ModelParser.parse as Mock).mockReturnValue({ models: [], enums: [] });

    vi.spyOn(fs, 'readdirSync').mockImplementation(((p: unknown) => {
      if (String(p).includes('src/roles')) return ['global-role.ts'] as unknown as fs.Dirent[];
      if (String(p).includes('modules')) return ['test-module'] as unknown as fs.Dirent[];
      return [] as unknown as fs.Dirent[];
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

    vi.spyOn(fs, 'existsSync').mockImplementation(((p: unknown) => {
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
      ((p: unknown) => !String(p).endsWith('models.yaml')) as unknown as typeof fs.existsSync,
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

  it('should report success for auditApiModule (schema only)', async () => {
    const { ModuleLocator } = await import('../../../src/lib/module-locator.js');
    (ModuleLocator.expand as Mock).mockResolvedValue([mockModuleInfo]);
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml'))
        return 'models: { User: { fields: { id: "String" }, role: "none" } }';
      if (ps.endsWith('api.yaml')) return '{}';
      return '';
    });
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('api.yaml')) return false;
      return true;
    });

    await auditApiModuleWrapper(mockCommand, 'test-api', { schema: true });
    expect(mockCommand.success).toHaveBeenCalledWith(expect.stringContaining('Audit passed'));
  });

  it('should report success for auditApiModule (full audit)', async () => {
    const { ModuleLocator } = await import('../../../src/lib/module-locator.js');
    (ModuleLocator.expand as Mock).mockResolvedValue([mockModuleInfo]);
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml'))
        return 'models: { User: { fields: { id: "String" }, role: "none" } }';
      if (ps.endsWith('api.yaml')) return '{}';
      return '';
    });
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('api.yaml')) return false;
      return true;
    });

    await auditApiModuleWrapper(mockCommand, 'test-api', { schema: false });
    if (mockCommand.success.mock.calls.length === 0) {
      const issues = mockCommand.info.mock.calls.map((c) => c[0]);
      throw new Error(`Audit failed unexpectedly:\n${issues.join('\n')}`);
    }
    expect(mockCommand.success).toHaveBeenCalledWith(expect.stringContaining('Audit passed'));
  });

  it('should handle enums and role maps in models', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) {
        return `
enums:
  Status:
    values: ["ACTIVE", "INACTIVE"]
models:
  User:
    role: { read: "none", write: "admin" }
    fields:
      id: "String"
      status: "Status"
`;
      }
      return '';
    });
    // This should hit line 145 and 186
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    // admin role is missing from global mock, so expect an issue for 'admin'
    expect(issues.some((i) => i.includes('admin'))).toBe(true);
    // status: Status should be valid (no semantic issue)
    // There might be a Zod issue if correctly configured now
    expect(issues.some((i) => i.includes("[Semantic] Model 'User.status' has unknown type"))).toBe(
      false,
    );
  });

  it('should audit virtual resources (custom routes)', async () => {
    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    (ModelParser.parse as Mock).mockReturnValue({
      models: [],
      enums: [],
    });

    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return true;
      if (ps.endsWith('api.yaml')) return true;
      return false; // Files like SDK, API, etc. are missing
    });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: {}';
      if (ps.endsWith('api.yaml'))
        return 'Root: [{ path: "/health", method: "get", output: "String" }]';
      return '';
    });

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    expect(issues.some((i) => i.includes('[Missing] src/pages/api/health.ts'))).toBe(true);
    expect(issues.some((i) => i.includes('[Missing] src/sdk/root-sdk.ts'))).toBe(true);
  });

  it('should report failure for auditApiModule when issues are found', async () => {
    const { ModuleLocator } = await import('../../../src/lib/module-locator.js');
    (ModuleLocator.expand as Mock).mockResolvedValue([mockModuleInfo]);
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'invalid-yaml: {';
      return '';
    });
    await auditApiModuleWrapper(mockCommand, 'test-api', {});
    expect(mockCommand.error).toHaveBeenCalled();
  });

  it('should handle api.yaml parse errors', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: {}';
      if (ps.endsWith('api.yaml')) return 'invalid: yaml : {';
      return '';
    });
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes('Failed to parse api.yaml'))).toBe(true);
  });

  it('should report issues from builders', async () => {
    const { BaseBuilder } = await import('../../../src/engine/builders/base-builder.js');
    vi.spyOn(BaseBuilder.prototype, 'validate').mockReturnValue({
      valid: false,
      issues: ['Builder issue'],
    });

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    expect(issues.some((i) => i.includes('Builder issue'))).toBe(true);
  });

  it('should audit non-root virtual resources', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml') || ps.endsWith('api.yaml')) return true;
      return false;
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: {}';
      if (ps.endsWith('api.yaml')) return 'OtherEntity: [{ path: "/foo", method: "get" }]';
      return '';
    });

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    // Should hit line 391
    expect(issues.some((i) => i.includes('[Missing] src/pages/api/other-entity/foo.ts'))).toBe(
      true,
    );
  });

  it('should handle unexpected exceptions in auditModule', async () => {
    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    (ModelParser.parse as Mock).mockImplementation(() => {
      throw new Error('Unexpected crash');
    });

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    expect(issues.some((i) => i.includes('Audit threw exception: Unexpected crash'))).toBe(true);
  });

  it('should use default pattern in auditApiModule when name is undefined', async () => {
    const { ModuleLocator } = await import('../../../src/lib/module-locator.js');
    (ModuleLocator.expand as Mock).mockResolvedValue([mockModuleInfo]);
    await auditApiModuleWrapper(mockCommand, undefined as unknown as string, {});
    expect(ModuleLocator.expand).toHaveBeenCalledWith('*-api');
  });

  it('should handle models with api but no db', async () => {
    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    (ModelParser.parse as Mock).mockReturnValue({
      models: [{ name: 'ApiOnly', api: true, db: false, fields: {} }],
      enums: [],
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: { ApiOnly: { api: true, db: false } }';
      return '';
    });
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    // Should NOT hit ServiceBuilder or TestBuilder branches
    expect(issues.some((i) => i.includes('Service'))).toBe(false);
  });

  it('should handle custom routes with various path formats', async () => {
    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    (ModelParser.parse as Mock).mockReturnValue({
      models: [{ name: 'User', api: true, db: true, fields: {} }],
      enums: [],
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: { User: { api: true, db: true } }';
      if (ps.endsWith('api.yaml'))
        return 'User: [{ path: "relative/path", method: "get" }, { path: "/", method: "post" }]';
      return '';
    });
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    // Path "relative/path" -> "relative/path" (sliced if starts with /)
    // Path "/" -> "" -> "index"
    expect(issues).toBeDefined();
  });

  it('should handle array types in custom routes', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: { User: { fields: { id: "String" } } }';
      if (ps.endsWith('api.yaml'))
        return 'User: [{ path: "/foo", method: "get", input: "User[]", output: "String[]" }]';
      return '';
    });
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    // Should hit line 211 and 219
    expect(issues.some((i) => i.includes('unknown input type'))).toBe(false);
  });

  it('should handle string exceptions in auditModule', async () => {
    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    (ModelParser.parse as Mock).mockImplementation(() => {
      throw 'String Exception';
    });

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    expect(issues.some((i) => i.includes('Audit threw exception: String Exception'))).toBe(true);
  });

  it('should handle models with api false or db false', async () => {
    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    (ModelParser.parse as Mock).mockReturnValue({
      models: [
        { name: 'NoApi', api: false, db: true, fields: { id: 'String' } },
        { name: 'NoDb', api: true, db: false, fields: { id: 'String' } },
      ],
      enums: [],
    });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml'))
        return 'models: { NoApi: { api: false, fields: { id: "String" } }, NoDb: { db: false, fields: { id: "String" } } }';
      return '';
    });
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    expect(issues.some((i) => i.includes('NoApi API'))).toBe(false);
  });

  it('should handle fields as objects and valid roles in api.yaml', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml'))
        return 'models: { User: { fields: { profile: { type: "String" } }, role: "none" } }';
      if (ps.endsWith('api.yaml')) return 'User: [{ path: "/me", method: "get", role: "none" }]';
      return '';
    });
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes('unknown type'))).toBe(false);
    expect(issues.some((i) => i.includes('unknown role'))).toBe(false);
  });

  it('should handle empty custom route path (Root)', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml') || ps.endsWith('api.yaml')) return true;
      return false;
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: {}';
      if (ps.endsWith('api.yaml')) return 'Root: [{ path: "/", method: "get" }]';
      return '';
    });
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    // Path "/" -> "" -> "index"
    expect(issues.some((i) => i.includes('src/pages/api/index.ts'))).toBe(true);
  });

  it('should handle non-existent module roots', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      if (String(p).includes('backend')) return false;
      return true;
    });
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues).toBeDefined();
  });
});
