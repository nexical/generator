/** @vitest-environment node */
/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { ActorBuilder } from '../../../../src/engine/builders/actor-builder';
import { type ModelDef } from '../../../../src/engine/types';

describe('ActorBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('actors.ts', '');
  });

  it('should generate login strategy actor', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        api: true,
        actor: { strategy: 'login', fields: { identifier: 'email', secret: 'password' } },
        fields: {
          email: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
    ];
    const builder = new ActorBuilder(models);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain(
      'user: async (client: ApiClient, params: Record<string, unknown> = {}) =>',
    );
    expect(text).toMatch(/client\.useSession\(\)\.post\(['"]\/api\/login['"]/);
    expect(text).toContain('email: actor.email');
  });

  it('should generate bearer strategy actor with hashing', () => {
    const models: ModelDef[] = [
      {
        name: 'Team',
        api: true,
        actor: { strategy: 'bearer', prefix: 'tm_', fields: { keyField: 'hashedKey' } },
        fields: {},
      },
    ];
    const builder = new ActorBuilder(models);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toMatch(/import crypto from ["']node:crypto["'];/);
    expect(text).toMatch(
      /crypto\.createHash\(['"]sha256["']\)\.update\(rawKey\)\.digest\(['"]hex["']\)/,
    );
    expect(text).toMatch(/prefix: ["']tm_["']/);
  });

  it('should generate api-key strategy actor', () => {
    const models: ModelDef[] = [
      {
        name: 'ServiceAccount',
        api: true,
        actor: {
          strategy: 'api-key',
          fields: { keyModel: 'ApiKey', ownerField: 'accountId' },
        },
        fields: {},
      },
    ];
    const builder = new ActorBuilder(models);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('accountId: actor.id');
    expect(text).toContain('Factory.prisma.serviceAccount.findUnique');
    expect(text).toContain('client.useToken(rawKey)');
  });

  it('should skip api-key strategy if fields are missing', () => {
    const models: ModelDef[] = [
      {
        name: 'ServiceAccount',
        api: true,
        actor: { strategy: 'api-key', fields: {} },
        fields: {},
      },
    ];
    const builder = new ActorBuilder(models);
    builder.ensure(sourceFile);

    expect(sourceFile.getFullText()).toMatch(/export const actors = \{[\s\n]*\};/);
  });

  it('should handle complex bearer token relations', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        api: true,
        actor: {
          strategy: 'bearer',
          fields: { tokenModel: 'AccessToken', ownerField: 'userId' },
        },
        fields: {
          id: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
      {
        name: 'AccessToken',
        api: true,
        fields: {
          user: {
            type: 'User',
            isRequired: true,
            isList: false,
            attributes: [],
            api: true,
            isRelation: true,
          },
          userId: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
    ];
    const builder = new ActorBuilder(models);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('user: { connect: { id: actor.id } }');
  });

  it('should fallback to inferred ownerField if relation not found', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        api: true,
        actor: {
          strategy: 'bearer',
          fields: { tokenModel: 'AccessToken', ownerField: 'userId' },
        },
        fields: {
          id: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
      {
        name: 'AccessToken',
        api: true,
        fields: {
          // No 'user' field here, just userId
          userId: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
    ];
    const builder = new ActorBuilder(models);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('user: { connect: { id: actor.id } }');
  });

  it('should use sourceId from actor field if present', () => {
    const models: ModelDef[] = [
      {
        name: 'TeamMember',
        api: true,
        actor: {
          strategy: 'bearer',
          fields: { tokenModel: 'AccessToken', ownerField: 'userId' },
        },
        fields: {
          userId: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
      {
        name: 'AccessToken',
        api: true,
        fields: {
          userId: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
    ];
    const builder = new ActorBuilder(models);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('user: { connect: { id: actor.userId } }');
  });

  it('should handle bearer token when target model has no back relation', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        api: true,
        db: true,
        actor: { strategy: 'bearer', fields: { tokenModel: 'AccessToken' } },
        fields: {
          id: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
      {
        name: 'AccessToken',
        api: true,
        db: true,
        fields: {
          token: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
    ];
    const builder = new ActorBuilder(models);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('accessToken'); // Prisma uses camelCase for the model in the factory/client
  });
});
