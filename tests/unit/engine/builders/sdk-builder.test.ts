/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { SdkBuilder } from '../../../../src/engine/builders/sdk-builder.js';
import { type ModelDef, type CustomRoute } from '../../../../src/engine/types.js';

describe('SdkBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;
  const model: ModelDef = {
    name: 'User',
    fields: {
      id: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
      name: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
    },
    api: true,
  };

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('UserSDK.ts', '');
  });

  it('should generate standard CRUD methods', () => {
    const builder = new SdkBuilder(model);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('export class UserSDK extends BaseResource');
    expect(text).toContain('public async list(');
    expect(text).toContain('public async get(id: string)');
    expect(text).toContain('public async create(data: Partial<User>)');
    expect(text).toContain('public async update(id: string, data: Partial<User>)');
    expect(text).toContain('public async delete(id: string)');
    expect(text).toMatch(/this\._request\('GET', `\/user\${query}`\);/);
  });

  it('should generate custom routes', () => {
    const customRoutes: CustomRoute[] = [
      {
        method: 'resetPassword',
        path: 'reset-password',
        verb: 'POST',
        input: 'ResetPasswordInput',
        output: 'void',
      },
    ];
    const builder = new SdkBuilder(model, customRoutes);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('public async resetPassword(data: ResetPasswordInput)');
    expect(text).toMatch(/this\._request\('POST', `\/user\/reset-password`, data\);/);
    expect(text).toMatch(
      /import type \{.*(User,.*ResetPasswordInput|ResetPasswordInput,.*User).*\} from "\.\/types\.js";/,
    );
  });

  it('should handle path parameters in custom routes', () => {
    const customRoutes: CustomRoute[] = [
      {
        method: 'verifyEmail',
        path: 'verify/[token]',
        verb: 'GET',
        output: 'boolean',
      },
    ];
    const builder = new SdkBuilder(model, customRoutes);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('public async verifyEmail(token: string)');
    expect(text).toMatch(/this\._request\('GET', `\/user\/verify\/\$\{token\}`\);/);
  });

  it('should respect role-based access for CRUD methods', () => {
    const restrictedModel: ModelDef = {
      ...model,
      role: { list: 'admin', delete: 'none' },
    };
    const builder = new SdkBuilder(restrictedModel);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('async list');
    expect(text).not.toContain('async delete');
  });

  it('should handle role as string', () => {
    const modelWithStringRole: ModelDef = {
      ...model,
      role: 'admin',
    };
    const builder = new SdkBuilder(modelWithStringRole);
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();
    expect(text).toContain('async list');
  });

  it('should handle virtual models with no fields', () => {
    const virtualModel: ModelDef = {
      name: 'Virtual',
      fields: {},
      db: false,
      api: true,
    };
    const builder = new SdkBuilder(virtualModel);
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();
    expect(text).toContain('export class VirtualSDK extends BaseResource');
  });

  it('should handle complex custom route edge cases', () => {
    const customRoutes: CustomRoute[] = [
      {
        method: 'deleteTag',
        path: 'tags/[tagId]/[type]',
        verb: 'DELETE',
        output: 'none',
        input: 'none',
      },
      {
        method: 'upload',
        path: 'upload',
        verb: 'POST',
        input: 'any',
      },
    ];
    const builder = new SdkBuilder(model, customRoutes);
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();
    expect(text).toContain(
      'public async deleteTag(tagId: string, type: string): Promise<{ success: boolean; data: void; error?: string }>',
    );
    expect(text).toContain('public async upload(data: any)');
  });

  it('should handle Kitchen Sink branches', () => {
    const rootModel: ModelDef = {
      name: 'Root',
      fields: {
        id: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
      },
      role: { get: 'none', list: 'member' },
      api: true,
    };
    const customRoutes: CustomRoute[] = [
      {
        method: 'noInputPost',
        path: 'no-input',
        verb: 'POST',
      },
    ];
    const builder = new SdkBuilder(rootModel, customRoutes);
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();
    expect(text).not.toContain('async get');
    expect(text).toContain(
      'public async noInputPost(data: unknown): Promise<{ success: boolean; data: unknown; error?: string }>',
    );
    expect(text).toMatch(/this\._request\('POST', `\/no-input`, data\);/);
  });

  it('should handle empty import list branch', () => {
    const virtualNoImport: ModelDef = {
      name: 'Void',
      fields: {},
      db: false,
      api: true,
    };
    // No custom routes that need imports
    const builder = new SdkBuilder(virtualNoImport);
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();
    expect(text).not.toContain('import type {');
  });
});
