/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { MiddlewareBuilder } from '../../../../src/engine/builders/middleware-builder';
import { type ModelDef } from '../../../../src/engine/types';

describe('MiddlewareBuilder Coverage', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
  });

  it('should handle tokenModel relation lookup', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        api: true,
        fields: {},
        actor: {
          name: 'user',
          prefix: 'sk_user',
          strategy: 'bearer',
          fields: { tokenModel: 'ApiKey' },
        },
      },
      {
        name: 'ApiKey',
        api: true,
        fields: {
          user: { type: 'User', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
    ];

    const builder = new MiddlewareBuilder(models);
    const sourceFile = project.createSourceFile('test.ts', '');
    builder.ensure(sourceFile);

    const body = sourceFile.getFunction('onRequest')?.getBodyText();
    expect(body).toContain('const tokenEntity = await db.apiKey.findFirst');
    expect(body).toContain('const entity = tokenEntity?.user;');
  });

  it('should trigger session hydration and bouncer with validStatus', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        api: true,
        fields: {
          status: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
        },
        actor: { strategy: 'login', validStatus: 'ACTIVE' },
      },
    ];

    const builder = new MiddlewareBuilder(models);
    const sourceFile = project.createSourceFile('test.ts', '');
    builder.ensure(sourceFile);

    const body = sourceFile.getFunction('onRequest')?.getBodyText();
    // Session hydration check
    expect(body).toContain('// Session Hydration');
    // Bouncer check
    expect(body).toContain('const actorCheck = await db.user.findUnique');
    expect(body).toContain("actorCheck.status !== 'ACTIVE'");
  });

  it('should handle anonymous routes', () => {
    const routes: import('../../../../src/engine/types').CustomRoute[] = [
      { path: '/public', role: 'anonymous', method: 'GET', verb: 'GET' },
    ];
    const builder = new MiddlewareBuilder([], routes);
    const sourceFile = project.createSourceFile('test.ts', '');
    builder.ensure(sourceFile);

    const body = sourceFile.getFunction('onRequest')?.getBodyText();
    expect(body).toContain('const publicRoutes: string[] = ["/public"];');
  });

  it('should handle non-hashed tokens', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        api: true,
        fields: {},
        actor: {
          name: 'user',
          prefix: 'sk_user',
          strategy: 'bearer',
          fields: { keyField: 'token' },
        },
      },
    ];

    const builder = new MiddlewareBuilder(models);
    const sourceFile = project.createSourceFile('test-non-hashed.ts', '');
    builder.ensure(sourceFile);

    const body = sourceFile.getFunction('onRequest')?.getBodyText();
    expect(body).not.toContain("crypto.createHash('sha256')");
  });

  it('should handle tokenModel lookup when relation is not found', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        api: true,
        fields: {},
        actor: {
          name: 'user',
          prefix: 'sk_user',
          strategy: 'bearer',
          fields: { tokenModel: 'ApiKey' },
        },
      },
      {
        name: 'ApiKey',
        api: true,
        fields: {
          // No User relation here
          something: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
    ];

    const builder = new MiddlewareBuilder(models);
    const sourceFile = project.createSourceFile('test-no-relation.ts', '');
    builder.ensure(sourceFile);

    const body = sourceFile.getFunction('onRequest')?.getBodyText();
    expect(body).toContain('const entity = tokenEntity?.user;'); // Fallback to lowercased model name
  });
});
