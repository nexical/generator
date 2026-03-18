/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import * as fs from 'fs';

// Use dynamic import
const auditModuleWrapper = async (cmd: unknown, info: unknown, schemaOnly: boolean) => {
  const { auditModule } = await import('@nexical/generator/lib/audit-api.js');
  return auditModule(
    cmd as unknown as import('@nexical/cli-core').BaseCommand,
    info as unknown as import('@nexical/generator/lib/module-locator.js').ModuleInfo,
    schemaOnly,
  );
};

const auditApiModuleWrapper = async (cmd: unknown, name: string, options: { schema?: boolean }) => {
  const { auditApiModule } = await import('@nexical/generator/lib/audit-api.js');
  return auditApiModule(cmd as unknown as import('@nexical/cli-core').BaseCommand, name, options);
};

vi.mock('fs');
vi.mock('@nexical/generator/lib/module-locator.js', () => ({
  ModuleLocator: {
    expand: vi.fn(),
  },
}));

vi.mock('@nexical/generator/engine/model-parser.js', () => ({
  ModelParser: {
    parse: vi.fn(),
  },
}));

vi.mock('@nexical/generator/engine/builders/type-builder.js', () => ({
  TypeBuilder: class {
    validate() {
      return { valid: false, issues: ['mismatch'] };
    }
  },
}));
vi.mock('@nexical/generator/engine/builders/service-builder.js', () => ({
  ServiceBuilder: class {
    validate() {
      return { valid: false, issues: ['mismatch'] };
    }
  },
}));
vi.mock('@nexical/generator/engine/builders/api-builder.js', () => ({
  ApiBuilder: class {
    validate() {
      return { valid: false, issues: ['mismatch'] };
    }
  },
}));
vi.mock('@nexical/generator/engine/builders/sdk-builder.js', () => ({
  SdkBuilder: class {
    validate() {
      return { valid: false, issues: ['mismatch'] };
    }
  },
}));
vi.mock('@nexical/generator/engine/builders/sdk-index-builder.js', () => ({
  SdkIndexBuilder: class {
    validate() {
      return { valid: false, issues: ['mismatch'] };
    }
  },
}));
vi.mock('@nexical/generator/engine/builders/init-builder.js', () => ({
  InitBuilder: class {
    validate() {
      return { valid: false, issues: ['mismatch'] };
    }
  },
}));
vi.mock('@nexical/generator/engine/builders/test-builder.js', () => ({
  TestBuilder: class {
    validate() {
      return { valid: false, issues: ['mismatch'] };
    }
  },
}));
vi.mock('@nexical/generator/engine/builders/action-builder.js', () => ({
  ActionBuilder: class {
    validate() {
      return { valid: false, issues: ['mismatch'] };
    }
  },
}));
vi.mock('@nexical/generator/engine/builders/factory-builder.js', () => ({
  FactoryBuilder: class {
    validate() {
      return { valid: false, issues: ['mismatch'] };
    }
  },
}));
vi.mock('@nexical/generator/engine/builders/actor-builder.js', () => ({
  ActorBuilder: class {
    validate() {
      return { valid: false, issues: ['mismatch'] };
    }
  },
}));
vi.mock('@nexical/generator/engine/builders/actor-type-builder.js', () => ({
  ActorTypeBuilder: class {
    validate() {
      return { valid: false, issues: ['mismatch'] };
    }
  },
}));

const mockFile = {
  getClasses: vi.fn().mockReturnValue([]),
  getInterfaces: vi.fn().mockReturnValue([]),
  getFunctions: vi.fn().mockReturnValue([]),
  getClass: vi.fn(),
  getInterface: vi.fn(),
};

const mockProject = {
  addSourceFileAtPath: vi.fn().mockReturnValue(mockFile),
};

vi.mock('ts-morph', () => ({
  Project: class {
    constructor() {
      return mockProject;
    }
    addSourceFileAtPath() {
      return mockFile;
    }
  } as unknown as typeof import('ts-morph').Project,
  SourceFile: vi.fn(),
}));

describe('AuditApi - Exhaustive Coverage', () => {
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
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('models: {}');
    vi.spyOn(fs, 'readdirSync').mockImplementation(((p: unknown) => {
      const ps = String(p);
      if (ps.includes('roles')) return ['admin.ts'] as unknown as fs.Dirent[];
      if (ps.includes('modules')) return ['mod1'] as unknown as fs.Dirent[];
      return [] as unknown as fs.Dirent[];
    }) as unknown as typeof fs.readdirSync);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should validate models.yaml against Zod schema', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('models: { User: { role: 123 } }');
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes('models.yaml validation errors'))).toBe(true);
  });

  it('should handle api.yaml validation errors', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(((p: unknown) => {
      if (String(p).endsWith('api.yaml')) return 'User: [{ path: 123 }]'; // path should be string
      return 'models: {}';
    }) as unknown as typeof fs.readFileSync);
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes('api.yaml validation errors'))).toBe(true);
  });

  it('should handle api.yaml parse failure', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(((p: unknown) => {
      if (String(p).endsWith('api.yaml')) return 'invalid : {';
      return 'models: {}';
    }) as unknown as typeof fs.readFileSync);
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    expect(issues.some((i) => i.includes('Failed to parse api.yaml'))).toBe(true);
  });

  it('should handle cross-module role scanning', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      'models: { User: { role: "admin", fields: { id: "String" } } }',
    );
    // Mock readdirSync to find roles in apps/backend/modules/mod1/src/roles/admin.ts
    vi.spyOn(fs, 'readdirSync').mockImplementation(((p: unknown) => {
      const ps = String(p);
      if (ps.includes('roles')) return ['admin.ts'];
      if (ps.includes('modules')) return ['mod1'];
      return [];
    }) as unknown as typeof fs.readdirSync);
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes('unknown role'))).toBe(false); // admin should be found
  });

  it('should cover virtual resources logic', async () => {
    const { ModelParser } = await import('@nexical/generator/engine/model-parser.js');
    (ModelParser.parse as Mock).mockReturnValue({ models: [], enums: [] });

    vi.spyOn(fs, 'readFileSync').mockImplementation(((p: unknown) => {
      if (String(p).endsWith('api.yaml'))
        return 'Virtual: [{ path: "/foo", method: "GET", verb: "GET" }]';
      return 'models: {}';
    }) as unknown as typeof fs.readFileSync);

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    expect(issues.some((i) => i.includes('[Virtual SDK] mismatch'))).toBe(true);
  });

  it('should handle root-level custom routes', async () => {
    const { ModelParser } = await import('@nexical/generator/engine/model-parser.js');
    (ModelParser.parse as Mock).mockReturnValue({ models: [], enums: [] });

    vi.spyOn(fs, 'readFileSync').mockImplementation(((p: unknown) => {
      if (String(p).endsWith('api.yaml'))
        return 'Root: [{ path: "ping", method: "GET", verb: "GET" }]';
      return 'models: {}';
    }) as unknown as typeof fs.readFileSync);

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    expect(issues.some((i) => i.includes('[Root API ping] mismatch'))).toBe(true);
  });

  it('should cover auditApiModule with multiple modules', async () => {
    const { ModuleLocator } = await import('@nexical/generator/lib/module-locator.js');
    (ModuleLocator.expand as Mock).mockResolvedValue([
      { name: 'api1', path: '/p1', app: 'backend' },
      { name: 'api2', path: '/p2', app: 'backend' },
    ]);

    vi.spyOn(fs, 'existsSync').mockReturnValue(false); // Force issues (missing models.yaml)

    await auditApiModuleWrapper(mockCommand, '*-api', {});
    expect(mockCommand.error).toHaveBeenCalledWith(
      expect.stringContaining('Audit failed with 2 issues'),
    );
  });

  it('should catch auditModule exceptions', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(() => {
      throw new Error('Boom');
    });
    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues[0]).toContain('Audit threw exception: Boom');
  });
});
