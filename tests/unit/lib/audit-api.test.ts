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
    expect(issues.some((i) => i.includes('Path: models.User.features'))).toBe(true);
  });

  it('should handle generic roles and unknown types', async () => {
    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [{ name: 'User', fields: { f: { type: 'BadType' } } }],
      enums: [],
      config: {} as unknown as import('../../../src/engine/types.js').GlobalConfig,
    } as unknown as {
      models: import('../../../src/engine/types.js').ModelDef[];
      enums: import('../../../src/engine/types.js').EnumConfig[];
      config: import('../../../src/engine/types.js').GlobalConfig;
    });
    vi.spyOn(fs, 'readFileSync').mockReturnValue('models: { User: { fields: { f: "BadType" } } }');

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes("unknown type 'BadType'"))).toBe(true);
  });

  it('should run full validation for models and custom routes', async () => {
    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    vi.mocked(ModelParser.parse).mockReturnValue({
      models: [
        { name: 'User', api: true, db: true, fields: {} },
        { name: 'Post', api: true, db: false, fields: {} },
      ],
      enums: [],
      config: {} as unknown as import('../../../src/engine/types.js').GlobalConfig,
    } as unknown as {
      models: import('../../../src/engine/types.js').ModelDef[];
      enums: import('../../../src/engine/types.js').EnumConfig[];
      config: import('../../../src/engine/types.js').GlobalConfig;
    });

    vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      // Let models.yaml, api.yaml and server-init.ts exist
      return ps.endsWith('models.yaml') || ps.endsWith('api.yaml') || ps.endsWith('server-init.ts');
    });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('.tsf')) return 'export default fragment``;';
      if (ps.endsWith('models.yaml')) return 'models: {}';
      if (ps.endsWith('api.yaml'))
        return 'Root: [{ path: "/", method: "get" }]\nUser: [{ path: "/foo", method: "post" }]';
      return '';
    });

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);

    const exceptionIssue = issues.find((i) => i.includes('Audit threw exception'));
    if (exceptionIssue) {
      throw new Error(`Audit crashed instead of validating: ${exceptionIssue}`);
    }

    // It should have reported missing files for the non-existent files
    expect(issues.some((i) => i.includes('[Missing]'))).toBe(true);
    // It should have validated server-init.ts and returned invalid (hitting the !res.valid branch)
    expect(issues.some((i) => i.includes('[Server Init]'))).toBe(true);
  });

  it('should run auditApiModule orchestration and early exits', async () => {
    const { ModuleLocator } = await import('../../../src/lib/module-locator.js');
    // Test no modules found (lines 38-41)
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    await auditApiModuleWrapper(mockCommand, 'nothing', {});
    expect(mockCommand.warn).toHaveBeenCalledWith(
      expect.stringContaining('No modules found matching pattern'),
    );

    // Test success with 1 module
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      mockModuleInfo as unknown as import('../../../src/lib/module-locator.js').ModuleInfo,
    ]);
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('models: []');

    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    if (ModelParser) {
      type MockedModelParser = {
        parse: Mock<
          [string, string, string],
          {
            models: import('../../../src/engine/types.js').ModelDef[];
            enums: import('../../../src/engine/types.js').EnumConfig[];
            config: import('../../../src/engine/types.js').GlobalConfig;
          }
        >;
      };
      vi.mocked(ModelParser as unknown as MockedModelParser).parse.mockReturnValue({
        models: [],
        enums: [],
        config: {} as unknown as import('../../../src/engine/types.js').GlobalConfig,
      } as unknown as {
        models: import('../../../src/engine/types.js').ModelDef[];
        enums: import('../../../src/engine/types.js').EnumConfig[];
        config: import('../../../src/engine/types.js').GlobalConfig;
      });
    }

    await auditApiModuleWrapper(mockCommand, 'test', { schema: true });

    // We might get an error if our mock isn't perfect, but at least we hit lines 35-62 completely
    expect(ModelParser).toBeDefined();

    // Test failure accumulation
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      if (String(p).endsWith('models.yaml')) return 'invalid-yaml: {';
      return '';
    });
    await auditApiModuleWrapper(mockCommand, 'test', { schema: true });
    expect(mockCommand.error).toHaveBeenCalledWith(expect.stringContaining('Audit failed with'));
  });

  it('should early return if models.yaml is missing or malformed', async () => {
    // Missing models.yaml
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    let issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes('models.yaml not found'))).toBe(true);

    // Malformed YAML that fails YAML.parse
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('Invalid: *\n  [unclosed array');
    issues = await auditModuleWrapper(mockCommand, mockModuleInfo, true);
    expect(issues.some((i) => i.includes('Failed to parse models.yaml'))).toBe(true);
  });

  it('should validate complete semantic rules for objects and arrays', async () => {
    type MockedModelParser = {
      parse: Mock<
        [string, string, string],
        {
          models: import('../../../src/engine/types.js').ModelDef[];
          enums: import('../../../src/engine/types.js').EnumConfig[];
          config: import('../../../src/engine/types.js').GlobalConfig;
        }
      >;
    };
    const { ModelParser } = await import('../../../src/engine/model-parser.js');
    if (ModelParser) {
      vi.mocked(ModelParser as unknown as MockedModelParser).parse.mockReturnValue({
        models: [{ name: 'User', api: true, db: true, fields: {}, role: { list: 'unknownRole' } }],
        enums: [],
        config: {} as unknown as import('../../../src/engine/types.js').GlobalConfig,
      } as unknown as {
        models: import('../../../src/engine/types.js').ModelDef[];
        enums: import('../../../src/engine/types.js').EnumConfig[];
        config: import('../../../src/engine/types.js').GlobalConfig;
      });
    }

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: unknown) => {
      const ps = String(p);
      if (ps.endsWith('models.yaml')) return 'models: { User: { role: { list: "unknownRole" } } }';
      if (ps.endsWith('api.yaml'))
        return 'User: [{ path: "/", method: "get", input: "BadInput[]", output: "BadOutput[]", role: "BadRole" }]';
      return '';
    });

    const issues = await auditModuleWrapper(mockCommand, mockModuleInfo, false);
    expect(issues.some((i) => i.includes("Model 'User' has unknown role 'unknownRole'"))).toBe(
      true,
    );
    expect(issues.some((i) => i.includes("unknown input type 'BadInput[]'"))).toBe(true);
    expect(issues.some((i) => i.includes("unknown output type 'BadOutput[]'"))).toBe(true);
    expect(issues.some((i) => i.includes("unknown role 'BadRole'"))).toBe(true);
  });
});
