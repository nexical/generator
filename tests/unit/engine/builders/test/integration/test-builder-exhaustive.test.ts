/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { IntegrationTestBuilder } from '@nexical/generator/engine/builders/test/integration/integration-test-builder.js';
import { type ModelDef } from '@nexical/generator/engine/types.js';

describe('IntegrationTestBuilder - Exhaustive Coverage', () => {
  const complexModel: ModelDef = {
    name: 'Complex',
    db: true,
    api: true,
    fields: {
      id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
      bool: { type: 'Boolean', isRequired: true, isList: false, api: true, attributes: [] },
      int: { type: 'Int', isRequired: true, isList: false, api: true, attributes: [] },
      float: { type: 'Float', isRequired: true, isList: false, api: true, attributes: [] },
      date: { type: 'DateTime', isRequired: true, isList: false, api: true, attributes: [] },
      json: { type: 'Json', isRequired: true, isList: false, api: true, attributes: [] },
      list: { type: 'String', isRequired: true, isList: true, api: true, attributes: [] },
      // Required FK
      jobId: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      job: {
        type: 'Job',
        isRequired: true,
        isList: false,
        api: false,
        isRelation: true,
        attributes: ['@relation(fields: [jobId])'],
      },
      // Unique fields for randomization coverage
      email: {
        type: 'String',
        isRequired: true,
        isList: false,
        api: true,
        attributes: ['@unique'],
      },
      username: {
        type: 'String',
        isRequired: true,
        isList: false,
        api: true,
        attributes: ['@unique'],
      },
      token: {
        type: 'String',
        isRequired: true,
        isList: false,
        api: true,
        attributes: ['@unique'],
      },
      // Actor relation
      actorId: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
    },
    test: { actor: 'User' },
    role: { create: 'admin', list: 'admin', get: 'admin', update: 'admin', delete: 'admin' },
  };

  const roleConfig = {
    ADMIN: { role: 'admin' },
  };

  it('should cover all field types in CREATE', () => {
    const builder = new IntegrationTestBuilder(
      complexModel,
      [],
      'ComplexApi',
      'create',
      roleConfig,
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();

    expect(text).toContain("Factory.create('job'");
    expect(text).toContain('bool: true');
    expect(text).toContain('int: 10');
    expect(text).toContain('float: 10.5');
    // It uses new Date().toISOString() in payload but compares res.body.data.date with it.
    expect(text).toContain('expect(res.body.data.date).toBe(payload.date)');
  });

  it('should cover all filter types in LIST', () => {
    const builder = new IntegrationTestBuilder(complexModel, [], 'ComplexApi', 'list', roleConfig);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();

    expect(text).toContain('should filter by bool');
    expect(text).toContain('should filter by int');
    expect(text).toContain('should filter by float');
    expect(text).toContain('should filter by date');
  });

  it('should cover preserved actor logic in LIST for Auth resources', () => {
    const authModel: ModelDef = {
      name: 'AuthToken',
      db: true,
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        userId: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
        user: {
          type: 'User',
          isRequired: true,
          isList: false,
          api: false,
          isRelation: true,
          attributes: ['@relation(fields: [userId])'],
        },
      },
      test: { actor: 'User' },
    };
    const builder = new IntegrationTestBuilder(authModel, [], 'AuthTokenApi', 'list', roleConfig);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test_auth.ts', '');
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();

    expect(text).toContain(
      'await Factory.prisma.authToken.count({ where: { userId: actor ? (actor as unknown as { id: string }).id : undefined } })',
    );
  });

  it('should cover dependency setup in GET, UPDATE, DELETE', () => {
    const project = new Project({ useInMemoryFileSystem: true });

    for (const op of ['get', 'update', 'delete'] as const) {
      const builder = new IntegrationTestBuilder(complexModel, [], 'ComplexApi', op, roleConfig);
      const sourceFile = project.createSourceFile(`test_${op}.ts`, '');
      builder.ensure(sourceFile);
      const text = sourceFile.getFullText();
      expect(text).toContain("Factory.create('job'");
      if (op === 'update') {
        expect(text).toContain('bool: false');
        expect(text).toContain('int: 20');
        expect(text).toContain(
          `actorId: (actor ? (actor as unknown as { id: string }).id : undefined)`,
        );
        expect(text).toContain('float: 20.5');
      }
    }
  });

  it('should cover actor-self case (isActorModel)', () => {
    const userModel: ModelDef = {
      name: 'User',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
      },
      test: { actor: 'User' },
    };
    for (const op of ['get', 'update', 'delete'] as const) {
      const builder = new IntegrationTestBuilder(userModel, [], 'UserApi', op, roleConfig);
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(`test_self_${op}.ts`, '');
      builder.ensure(sourceFile);
      expect(sourceFile.getFullText()).toContain('const target = actor;');
    }
  });

  it('should cover Job model special case in dependencies', () => {
    const modelWithJob: ModelDef = {
      name: 'Task',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        jobId: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
        job: {
          type: 'Job',
          isRequired: true,
          isList: false,
          api: false,
          isRelation: true,
          attributes: ['@relation(fields: [jobId])'],
        },
      },
      test: { actor: 'User' },
    };
    const jobModel: ModelDef = {
      name: 'Job',
      db: true,
      api: true,
      traits: ['actor-linked'],
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
      },
    };
    const builder = new IntegrationTestBuilder(
      modelWithJob,
      [jobModel],
      'TaskApi',
      'create',
      roleConfig,
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test_job.ts', '');
    builder.ensure(sourceFile);
    expect(sourceFile.getFullText()).toContain("actorType: 'User'");
  });

  it('should cover space-separated ID field fallback (no @relation)', () => {
    const modelWithSpaceId: ModelDef = {
      name: 'Item',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        'user Id': { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
        user: {
          type: 'User',
          isRequired: true,
          isList: false,
          api: false,
          isRelation: true,
          attributes: [],
        },
      },
      test: { actor: 'User' },
    };
    const builder = new IntegrationTestBuilder(
      modelWithSpaceId,
      [],
      'ItemApi',
      'create',
      roleConfig,
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test_space_2.ts', '');
    builder.ensure(sourceFile);
    // Should hit line 345: return `${name} Id` -> `user Id`
    expect(sourceFile.getFullText()).toContain('user Id: (actor');
  });

  it('should cover no actor FK case', () => {
    const modelNoFk: ModelDef = {
      name: 'Isolated',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
      },
      test: { actor: 'User' },
    };
    const builder = new IntegrationTestBuilder(modelNoFk, [], 'IsolatedApi', 'create', roleConfig);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test_no_fk.ts', '');
    builder.ensure(sourceFile);
    // Should hit line 107/348 fallback
    expect(sourceFile.getFullText()).toContain("const _actor = await client.as('User', {});");
  });

  it('should cover isActorModel in CREATE', () => {
    const userModel: ModelDef = {
      name: 'User',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
      },
      test: { actor: 'User' },
    };
    const builder = new IntegrationTestBuilder(userModel, [], 'UserApi', 'create', roleConfig);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test_user_create.ts', '');
    builder.ensure(sourceFile);
    // User model (isActorModel=true) in CREATE should just work
    expect(sourceFile.getFullText()).toContain('id: "id_test"');
  });

  it('should cover role-value matching (lines 85-88)', () => {
    const ownerRoleConfig = {
      OWNER: { role: 'OWNER', some: 'opt' },
    };
    new IntegrationTestBuilder(complexModel, [], 'ComplexApi', 'create', ownerRoleConfig);
    // complexModel.role.create is 'admin'. Uppercase is 'ADMIN'.
    // ownerRoleConfig has key 'OWNER'. Not a match for line 75.
    // val.role is 'OWNER'. Not a match for 'ADMIN' in line 84.

    // Let's make it match:
    const matchingRoleConfig = {
      SOME_KEY: { role: 'ADMIN', extra: true },
    };
    const builder2 = new IntegrationTestBuilder(
      complexModel,
      [],
      'ComplexApi',
      'create',
      matchingRoleConfig,
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test_role_match.ts', '');
    builder2.ensure(sourceFile);
    expect(sourceFile.getFullText()).toContain("{role:'ADMIN',extra:true}");
  });

  it('should cover getActorForeignKey fallback to field name (line 218)', () => {
    const modelWithUserField: ModelDef = {
      name: 'Item',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        user: { type: 'User', isRequired: true, isList: false, api: true, attributes: [] },
      },
      test: { actor: 'User' },
    };
    const builder = new IntegrationTestBuilder(
      modelWithUserField,
      [],
      'ItemApi',
      'create',
      roleConfig,
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test_user_field.ts', '');
    builder.ensure(sourceFile);
    // Should hit line 218 and return 'user'
    expect(sourceFile.getFullText()).toContain('user: (actor');
  });

  it('should cover unique field randomization (custom @unique)', () => {
    const modelWithUnique: ModelDef = {
      name: 'Unique',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        custom: {
          type: 'String',
          isRequired: true,
          isList: false,
          api: true,
          attributes: ['@unique'],
        },
      },
      test: { actor: 'User' },
    };
    const builder = new IntegrationTestBuilder(
      modelWithUnique,
      [],
      'UniqueApi',
      'list',
      roleConfig,
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test_unique.ts', '');
    builder.ensure(sourceFile);
    expect(sourceFile.getFullText()).toContain("custom: 'list_1_' + _listSuffix");
  });

  it('should cover userId snippet (line 61)', () => {
    const postModel: ModelDef = {
      name: 'Post',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        userId: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      },
      test: { actor: 'User' },
    };
    const getBuilder = new IntegrationTestBuilder(postModel, [], 'PostApi', 'get', roleConfig);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFileGet = project.createSourceFile('test_post_get.ts', '');
    getBuilder.ensure(sourceFileGet);
    expect(sourceFileGet.getFullText()).toContain('userId: (actor ?');
  });

  it('should cover isActorModel cleanup in LIST (line 450)', () => {
    const userModel: ModelDef = {
      name: 'User',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
      },
      test: { actor: 'User' },
    };
    const builder = new IntegrationTestBuilder(userModel, [], 'UserApi', 'list', roleConfig);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test_user_list_cleanup.ts', '');
    builder.ensure(sourceFile);
    expect(sourceFile.getFullText()).toContain(
      'await Factory.prisma.user.deleteMany({ where: { id: { not: actor.id } } });',
    );
  });

  it('should cover isAuthResource with actor FK in LIST (line 445)', () => {
    const tokenModel: ModelDef = {
      name: 'UserToken',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        userId: {
          type: 'User',
          isRequired: true,
          isList: false,
          api: true,
          attributes: ['@relation(fields: [user_id], ...)', 'user_id String'],
        },
        user_id: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      },
      test: { actor: 'User' },
    };
    const builder = new IntegrationTestBuilder(tokenModel, [], 'UserTokenApi', 'list', roleConfig);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test_token_list.ts', '');
    builder.ensure(sourceFile);
    // shouldPreserve = isActorModel (false) || (true && true) = true
    expect(sourceFile.getFullText()).toContain(
      'await Factory.prisma.userToken.deleteMany({ where: { user_id: { not: actor.id } } });',
    );
  });
});
