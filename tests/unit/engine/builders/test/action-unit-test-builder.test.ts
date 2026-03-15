/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { ActionUnitTestBuilder } from '@nexical/generator/engine/builders/test/action-unit-test-builder.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';

vi.mock('@nexical/generator/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn((_name, _data) => `// Mock content for ${_name}`),
  },
}));

interface ActionTemplateData {
  actionName: string;
  defaultStatus: string;
  services: Array<{ name: string; path: string }>;
}

describe('ActionUnitTestBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
    vi.clearAllMocks();
  });

  it('should generate correct schema with service discovery', () => {
    const builder = new ActionUnitTestBuilder(
      'UserAction',
      '../actions/user-action',
      sourceFile,
      [],
      'User',
    );

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();

    expect(_schema.header).toBe('// GENERATED CODE - DO NOT MODIFY');
    expect(_schema.statements).toHaveLength(1); // One TemplateLoader.load call

    expect(TemplateLoader.load).toHaveBeenCalledWith(
      'test/unit/action.tsf',
      expect.objectContaining({
        actionName: 'UserAction',
        defaultStatus: 'ACTIVE',
      }),
    );
  });

  it('should handle Auth/Invite/Register actions for PENDING status', () => {
    const builder = new ActionUnitTestBuilder(
      'RegisterUserAction',
      '../actions/register-action',
      sourceFile,
      [],
      'User',
    );

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    expect(TemplateLoader.load).toHaveBeenCalledWith(
      'test/unit/action.tsf',
      expect.objectContaining({
        defaultStatus: 'PENDING',
      }),
    );
  });

  it('should discover services from relative and absolute imports', () => {
    sourceFile.addImportDeclaration({
      moduleSpecifier: './user.service',
      namedImports: ['UserService'],
    });
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@modules/global',
      namedImports: ['GlobalService'],
    });

    const builder = new ActionUnitTestBuilder('UserAction', '../actions/user-action', sourceFile);

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const data = vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as ActionTemplateData;
    expect(data.services).toContainEqual(
      expect.objectContaining({ name: 'UserService', path: '../../../src/actions/./user.service' }),
    );
    expect(data.services).toContainEqual(
      expect.objectContaining({ name: 'GlobalService', path: '@modules/global' }),
    );
  });

  it('should handle duplicate service imports gracefully', () => {
    sourceFile.addImportDeclaration({
      moduleSpecifier: './user.service',
      namedImports: ['UserService'],
    });
    // Add same service again (maybe from different naming or just redundant import)
    sourceFile.addImportDeclaration({
      moduleSpecifier: '../other/user.service',
      namedImports: ['UserService'],
    });

    const builder = new ActionUnitTestBuilder('UserAction', '../actions/user-action', sourceFile);

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const data = vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as ActionTemplateData;
    const userServices = data.services.filter((s) => s.name === 'UserService');
    expect(userServices).toHaveLength(1); // Only the first one should be pushed
  });

  it('should handle non-relative service imports', () => {
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@modules/global',
      namedImports: ['GlobalService'],
    });

    const builder = new ActionUnitTestBuilder('UserAction', '../actions/user-action', sourceFile);

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const data = vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as ActionTemplateData;
    expect(data.services).toContainEqual(
      expect.objectContaining({ name: 'GlobalService', path: '@modules/global' }),
    );
  });
});
