/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { MiddlewareBuilder } from '../../../../src/engine/builders/middleware-builder';
import { type ModelDef } from '../../../../src/engine/types';

describe('MiddlewareBuilder Auth Logic', () => {
  it('should generate token lookup via separate model', () => {
    const userModel: ModelDef = {
      name: 'User',
      db: true,
      api: true,
      fields: {
        id: { type: 'Int', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        name: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      },
      actor: {
        name: 'User',
        strategy: 'bearer',
        prefix: 'sk_live_',
        fields: {
          tokenModel: 'Session',
          keyField: 'tokenValue',
        },
      },
    };

    const sessionModel: ModelDef = {
      name: 'Session',
      db: true,
      api: true,
      fields: {
        id: { type: 'Int', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        tokenValue: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
        userId: { type: 'Int', isRequired: true, isList: false, api: true, attributes: [] },
        user: {
          type: 'User',
          isRequired: true,
          isList: false,
          api: true,
          isRelation: true,
          attributes: ['@relation(fields: [userId], references: [id])'],
        },
      },
    };

    const builder = new MiddlewareBuilder([userModel, sessionModel]);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('middleware.ts', '');

    builder.ensure(sourceFile);
    const text = sourceFile.getText();

    expect(text).toContain('db.session.findFirst');
    expect(text).toContain('include: { user: true }');
    expect(text).toContain('const entity = tokenEntity?.user');
  });

  it('should generate hashed token lookup', () => {
    const apiKeyModel: ModelDef = {
      name: 'ApiKey',
      db: true,
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        hashedKey: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      },
      actor: {
        name: 'ApiKey',
        strategy: 'api-key',
        prefix: 'pk_',
        fields: {
          keyField: 'hashedKey', // contains 'hash' -> trigger hashing
        },
      },
    };

    const builder = new MiddlewareBuilder([apiKeyModel]);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('middleware.ts', '');

    builder.ensure(sourceFile);
    const text = sourceFile.getText();

    expect(text).toContain("crypto.createHash('sha256')");
    expect(text).toContain('where: { hashedKey: hashedToken }');
  });

  it('should generate bouncer pattern with whitelist status', () => {
    const userModel: ModelDef = {
      name: 'User',
      db: true,
      api: true,
      fields: {
        id: { type: 'Int', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        status: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      },
      actor: {
        name: 'User',
        strategy: 'login',
        validStatus: 'ACTIVE',
      },
    };

    const builder = new MiddlewareBuilder([userModel]);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('middleware.ts', '');

    builder.ensure(sourceFile);
    const text = sourceFile.getText();

    expect(text).toContain("context.locals.actorType === 'user'");
    expect(text).toContain("!actorCheck || actorCheck.status !== 'ACTIVE'");
    expect(text).toContain('Session revoked');
  });

  it('should generate bouncer pattern with blacklist status (legacy)', () => {
    const userModel: ModelDef = {
      name: 'User',
      db: true,
      api: true,
      fields: {
        id: { type: 'Int', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        status: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      },
      actor: {
        name: 'User',
        strategy: 'login',
        // No validStatus -> blacklist
      },
    };

    const builder = new MiddlewareBuilder([userModel]);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('middleware.ts', '');

    builder.ensure(sourceFile);
    const text = sourceFile.getText();

    expect(text).toContain("context.locals.actorType === 'user'");
    expect(text).toContain("actorCheck.status === 'BANNED'");
    expect(text).toContain('Session revoked');
  });
});
