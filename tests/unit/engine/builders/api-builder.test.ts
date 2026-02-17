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
});
