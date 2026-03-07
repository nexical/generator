import { describe, it, expect, vi } from 'vitest';
import { ApiBuilder } from '../../../../src/engine/builders/api-builder.js';
import { Project } from 'ts-morph';
import type { ModelDef } from '../../../../src/engine/types.js';

vi.mock('../../../../src/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn((path, vars) => `({ path: "${path}", vars: ${JSON.stringify(vars)} })`),
  },
}));

describe('ApiBuilder - Coverage Boost', () => {
  const mockAllModels: ModelDef[] = [
    {
      name: 'User',
      api: true,
      fields: {
        id: {
          type: 'String',
          isRequired: true,
          attributes: ['@id', '@default(uuid())'],
          isList: false,
          api: true,
        },
        email: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
        password: {
          type: 'String',
          isRequired: true,
          private: true,
          isList: false,
          api: true,
          attributes: [],
        },
        role: {
          type: 'UserRole',
          isEnum: true,
          isRequired: false,
          isList: false,
          api: true,
          attributes: [],
        },
        posts: {
          type: 'Post[]',
          isRelation: true,
          relationTo: 'Post',
          isList: true,
          isRequired: false,
          api: true,
          attributes: [],
        },
      },
    },
    {
      name: 'Post',
      api: true,
      fields: {
        id: {
          type: 'Int',
          isRequired: true,
          attributes: ['@id', '@default(autoincrement())'],
          isList: false,
          api: true,
        },
        title: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
        content: { type: 'String', isRequired: false, api: false, isList: false, attributes: [] },
        author: {
          type: 'User',
          isRequired: true,
          isRelation: true,
          relationTo: 'User',
          isList: false,
          api: true,
          attributes: [],
        },
        published: {
          type: 'Boolean',
          isRequired: true,
          attributes: ['@default(false)'],
          isList: false,
          api: true,
        },
      },
    },
    {
      name: 'ProfileDTO',
      api: true,
      fields: {
        bio: { type: 'String', isRequired: false, isList: false, api: true, attributes: [] },
      },
    },
  ];

  it('should generate collection schema with various field types and roles', async () => {
    const model = JSON.parse(JSON.stringify(mockAllModels[0])); // User
    model.role = { list: 'public', create: 'admin' };

    const builder = new ApiBuilder(model, mockAllModels, 'user-api', 'collection');
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile('api_coll.ts', '');

    await builder.ensure(file);
    const content = file.getFullText();

    expect(content).toContain('UserRole');
    expect(content).toContain('public');
    expect(content).toContain('admin');
  });

  it('should generate individual schema with partial update and roles', async () => {
    const model = JSON.parse(JSON.stringify(mockAllModels[1])); // Post
    model.role = 'member'; // String role

    const builder = new ApiBuilder(model, mockAllModels, 'post-api', 'individual');
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile('api_ind.ts', '');

    await builder.ensure(file);
    const content = file.getFullText();

    expect(content).toContain('published');
    expect(content).toContain('member');
    expect(content).toContain('author');
  });

  it('should handle complex field validators (DateTime, Json, Float)', async () => {
    const complexModel = {
      name: 'Complex',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
        timestamp: { type: 'DateTime', isRequired: true, isList: false, api: true, attributes: [] },
        meta: { type: 'Json', isRequired: false, isList: false, api: true, attributes: [] },
        price: { type: 'Float', isRequired: false, isList: false, api: true, attributes: [] },
        tags: { type: 'String', isList: true, isRequired: false, api: true, attributes: [] },
      },
    };

    const builder = new ApiBuilder(
      complexModel as unknown as ModelDef,
      [complexModel] as unknown as ModelDef[],
      'test-api',
      'collection',
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile('api_complex.ts', '');

    await builder.ensure(file);
    const content = file.getFullText();

    expect(content).toContain('datetime()');
    expect(content).toContain('unknown');
    expect(content).toContain('number');
  });

  it('should handle role: none to exclude methods', async () => {
    const model = JSON.parse(JSON.stringify(mockAllModels[0]));
    model.role = { list: 'none', create: 'none' };

    const builder = new ApiBuilder(model, mockAllModels, 'user-api', 'collection');
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile('api_none.ts', '');

    await builder.ensure(file);
    const content = file.getFullText();

    expect(content).not.toContain('"GET"');
    expect(content).not.toContain('"POST"');
  });

  it('should handle Decimal and Int with default values', async () => {
    const model = {
      name: 'Finance',
      api: true,
      fields: {
        id: {
          type: 'Int',
          isRequired: true,
          attributes: ['@id', '@default(autoincrement())'],
          isList: false,
          api: true,
        },
        amount: { type: 'Decimal', isRequired: true, isList: false, api: true, attributes: [] },
      },
    };

    const builder = new ApiBuilder(
      model as unknown as ModelDef,
      [model] as unknown as ModelDef[],
      'finance-api',
      'collection',
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile('api_finance.ts', '');

    await builder.ensure(file);
    const content = file.getFullText();

    expect(content).toContain('number');
    expect(content).toContain('int');
    expect(content).toContain('optional');
  });

  it('should handle models with no visible fields', async () => {
    const model = {
      name: 'Secret',
      api: true,
      fields: {
        id: {
          type: 'String',
          private: true,
          isRequired: false,
          isList: false,
          api: true,
          attributes: [],
        },
        internal: { type: 'String', api: false, isRequired: false, isList: false, attributes: [] },
      },
    };

    const builder = new ApiBuilder(
      model as unknown as ModelDef,
      [model] as unknown as ModelDef[],
      'secret-api',
      'collection',
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile('api_secret.ts', '');

    await builder.ensure(file);
    const content = file.getFullText();

    expect(content).toContain('passthrough');
  });
});
