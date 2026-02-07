/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { TestBuilder } from '../../../../src/engine/builders/test-builder';
import { type ModelDef } from '../../../../src/engine/types';

describe('TestBuilder', () => {
  const userModel: ModelDef = {
    name: 'User',
    db: true,
    api: true,
    fields: {
      id: {
        type: 'String',
        isRequired: true,
        isList: false,
        api: true,
        attributes: ['@id', '@default(cuid())'],
      },
      email: {
        type: 'String',
        isRequired: true,
        isList: false,
        api: true,
        attributes: ['@unique'],
      },
      name: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
    },
    test: { actor: 'User' }, // Self-acting
  };

  const postModel: ModelDef = {
    name: 'Post',
    db: true,
    api: true,
    fields: {
      id: {
        type: 'Int',
        isRequired: true,
        isList: false,
        api: true,
        attributes: ['@id', '@default(autoincrement())'],
      },
      title: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      authorId: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      author: {
        type: 'User',
        isRequired: true,
        isList: false,
        api: false,
        isRelation: true,
        attributes: ['@relation(fields: [authorId])'],
      },
    },
    test: { actor: 'User' }, // User acts on Post
  };

  const restrictedModel: ModelDef = {
    name: 'AdminDoc',
    db: true,
    api: true,
    fields: {
      id: { type: 'Int', isRequired: true, isList: false, api: true, attributes: ['@id'] },
      content: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
    },
    role: { list: 'admin', create: 'admin' },
    test: { actor: 'User' },
  };

  it('should generate CREATE tests', () => {
    const builder = new TestBuilder(userModel, 'UserApi', 'create');
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain("describe('User API - Create'");
    expect(text).toContain("client.post('/api/user', payload)");
    expect(text).toContain('expect(res.status).toBe(201)');
  });

  it('should generate LIST tests with pagination and filters', () => {
    const builder = new TestBuilder(postModel, 'PostApi', 'list');
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain("describe('GET /api/post'");
    expect(text).toContain('should verify pagination metadata');
    expect(text).toContain("client.get('/api/post?take=5&skip=0')");
    expect(text).toContain('should filter by title');
  });

  it('should generate GET tests with dependency setup', () => {
    const builder = new TestBuilder(postModel, 'PostApi', 'get');
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain(
      'const target = await Factory.create(\'post\', { ...{"title":"title_test"}, author: { connect: { id: actor.id } } });',
    );
    expect(text).toContain('client.get(`/api/post/${target.id}`)');
  });

  it('should generate POST tests for restricted roles', () => {
    // Pass roleConfig so the builder knows what options to use for 'admin'
    const roleConfig = { admin: { role: 'admin' } };
    const builder = new TestBuilder(restrictedModel, 'AdminDocApi', 'create', roleConfig);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    // Should have negative test
    expect(text).toContain('should forbid non-admin/unauthorized users');
    expect(text).toContain("const actor = await client.as('User', {role:'admin'});");
  });

  it('should generate DELETE tests', () => {
    const builder = new TestBuilder(postModel, 'PostApi', 'delete');
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain("describe('DELETE /api/post/[id]'");
    expect(text).toContain('client.delete(`/api/post/${target.id}`)');
  });
});
