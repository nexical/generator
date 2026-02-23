/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { ApiBuilder } from '../../../../src/engine/builders/api-builder.js';
import { type ModelDef } from '../../../../src/engine/types.js';

describe('ApiBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;
  const model: ModelDef = {
    name: 'User',
    fields: {
      id: {
        type: 'String',
        isRequired: true,
        isList: false,
        attributes: ['@default(cuid())'],
        api: true,
      },
      email: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
      age: { type: 'Int', isRequired: false, isList: false, attributes: [], api: true },
    },
    api: true,
  };

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile(`api-${Math.random().toString(36).substring(7)}.ts`, '');
  });

  it('should generate collection schema (GET/POST)', () => {
    const builder = new ApiBuilder(model, [model], 'user-api', 'collection');
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('export const GET = defineApi');
    expect(text).toContain('export const POST = defineApi');
    expect(text).toContain('UserService.list');
    expect(text).toContain('UserService.create');
    expect(text).toContain('z.object({');
    expect(text).toContain('email: z.string()');
  });

  it('should generate namespaced enums in zod schema', () => {
    const enumModel: ModelDef = {
      ...model,
      fields: {
        ...model.fields,
        status: {
          type: 'Status',
          isEnum: true,
          isRequired: true,
          isList: false,
          attributes: [],
          api: true,
        },
      },
    };
    const builder = new ApiBuilder(enumModel, [enumModel], 'user-api', 'collection');
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('status: z.nativeEnum(UserApiModuleTypes.Status)');
    expect(text).toContain('import type { UserApiModuleTypes } from "@/lib/api"');
  });

  it('should generate individual schema (GET/PUT/DELETE)', () => {
    const builder = new ApiBuilder(model, [model], 'user-api', 'individual');
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('export const GET = defineApi');
    expect(text).toContain('export const PUT = defineApi');
    expect(text).toContain('export const DELETE = defineApi');
    expect(text).toContain('UserService.get(id, select, actor)');
    expect(text).toContain('UserService.update(id, validated, select, actor)');
    expect(text).toContain('UserService.delete(id, actor)');
  });

  it('should generate custom schema for actions', () => {
    const routes = [
      {
        method: 'resetPassword',
        path: '/reset-password',
        verb: 'POST' as const,
        input: 'ResetPasswordInput',
        output: 'void',
        role: 'member',
      },
    ];
    const builder = new ApiBuilder(model, [model], 'user-api', 'custom', routes);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('export const POST = defineApi');
    expect(text).toContain('ResetPasswordUserAction.run');
    expect(text).toContain(
      'import { ResetPasswordUserAction } from "@modules/user-api/src/actions/reset-password-user"',
    );
    // Verify strong typing restoration
    expect(text).toContain(
      'const body = await context.request.json() as UserApiModuleTypes.ResetPasswordInput;',
    );
    expect(text).toContain(
      "const input: UserApiModuleTypes.ResetPasswordInput = await HookSystem.filter('user.resetPassword.input', body);",
    );
  });

  it('should handle role-based restriction in API generation', () => {
    const restrictedModel: ModelDef = {
      ...model,
      role: { list: 'admin', create: 'none' },
    };
    const builder = new ApiBuilder(restrictedModel, [restrictedModel], 'user-api', 'collection');
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('GET');
    expect(text).not.toContain('POST');
    expect(text).toContain("ApiGuard.protect(context, 'admin'");
  });

  it('should handle custom route returning a list of models', () => {
    const routes = [
      {
        method: 'listRecent',
        path: '/recent',
        verb: 'GET' as const,
        output: 'User[]',
        role: 'member',
      },
    ];
    const builder = new ApiBuilder(model, [model], 'user-api', 'custom', routes);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('schema: { type: "array", items: {');
    expect(text).toContain('type: "object"');
  });

  it('should handle custom route returning a DTO', () => {
    const routes = [
      {
        method: 'getStats',
        path: '/stats',
        verb: 'GET' as const,
        output: 'UserStatsResponse',
        role: 'member',
      },
    ];
    const builder = new ApiBuilder(model, [model], 'user-api', 'custom', routes);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('import type { UserApiModuleTypes } from "@/lib/api"');
    // Verify GET routes have empty body with correct type (unknown default)
    expect(text).toContain('const body = {} as unknown;');
  });
  it('should handle complex field types (Float, DateTime, Json)', () => {
    const complexModel: ModelDef = {
      ...model,
      fields: {
        ...model.fields,
        price: { type: 'Float', isRequired: true, isList: false, attributes: [], api: true },
        birthday: { type: 'DateTime', isRequired: false, isList: false, attributes: [], api: true },
        meta: { type: 'Json', isRequired: false, isList: false, attributes: [], api: true },
      },
    };
    const builder = new ApiBuilder(complexModel, [complexModel], 'user-api', 'collection');
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('price: z.number()');
    expect(text).toContain('birthday: z.string().datetime().optional()');
    expect(text).toContain('meta: z.unknown().optional()');
    expect(text).toContain('type: "number"');
    expect(text).toContain('format: "date-time"');
  });

  it('should handle anonymous role correctly', () => {
    const publicModel: ModelDef = {
      ...model,
      role: 'anonymous',
    };
    const builder = new ApiBuilder(publicModel, [publicModel], 'user-api', 'collection');
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('protected: false');
    expect(text).toContain("ApiGuard.protect(context, 'anonymous'");
  });

  it('should handle empty fields in select and zod generation', () => {
    const emptyModel: ModelDef = {
      name: 'Empty',
      fields: {},
      api: true,
    };
    const builder = new ApiBuilder(emptyModel, [emptyModel], 'user-api', 'collection');
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('z.object({}).passthrough()');
    expect(text).toContain('const select = {}');
  });

  it('should handle missing defaults on IDs, decimals, and private field redactions', () => {
    const customModel: ModelDef = {
      name: 'Transaction',
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true }, // No @default
        amount: { type: 'Decimal', isRequired: true, isList: false, attributes: [], api: true },
        secret: {
          type: 'String',
          isRequired: true,
          isList: false,
          attributes: [],
          api: true,
          private: true,
        },
        user: {
          type: 'User',
          isRequired: true,
          isList: false,
          attributes: [],
          api: true,
          isRelation: true,
          relationTo: 'User',
        },
        tags: {
          type: 'Tag',
          isRequired: false,
          isList: true,
          attributes: [],
          api: true,
          isRelation: true,
          relationTo: 'Tag',
        },
      },
      api: true,
    };
    const userModel: ModelDef = {
      name: 'User',
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
        password: {
          type: 'String',
          isRequired: true,
          isList: false,
          attributes: [],
          api: true,
          private: true,
        }, // private field triggers select logic
      },
      api: true,
    };
    const tagModel: ModelDef = {
      name: 'Tag',
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
        name: { type: 'String', isRequired: true, isList: false, attributes: [], api: true }, // NO private fields
      },
      api: true,
    };

    // Testing get, update, delete for individual schema (hits update payload parsing logic for decimal/id)
    const builder = new ApiBuilder(
      customModel,
      [customModel, userModel, tagModel],
      'user-api',
      'individual',
    );
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('amount: z.number()'); // tests Decimal handling
    expect(text).toContain('id: z.string()'); // ID without default becomes required
    // Test relation and private redactions
    expect(text).toContain('user: { select:');
    expect(text).toContain('id: true');
    expect(text).not.toContain('password: true');
    // Test non-private relations (array tag relation limits take: 10, but true)
    expect(text).toContain('tags: { take: 10 }');
  });

  it('should handle custom route array DTO endpoints and unknown return fallbacks', () => {
    const routes = [
      {
        method: 'getReport',
        path: '/report',
        verb: 'POST' as const,
        input: 'FilterDTO',
        output: 'ReportResponse[]',
        role: 'member',
      },
      {
        method: 'triggerJob',
        path: '/trigger',
        verb: 'POST' as const,
        input: 'unknown',
        output: 'unknown',
        role: 'member',
      },
      {
        method: 'getUnknownModel',
        path: '/unknown-model',
        verb: 'GET' as const,
        output: 'MissingModel', // model not in allModels
        role: 'member',
      },
    ];
    const builder = new ApiBuilder(model, [model], 'user-api', 'custom', routes);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();

    // Check DTO Array logic (falls back to object if no schema properties are defined)
    expect(text).toContain('schema: { type: "object" }'); // Check input FilterDTO and ReportResponse fallback
  });
});
