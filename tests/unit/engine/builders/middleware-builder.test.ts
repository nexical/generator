/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { MiddlewareBuilder } from '../../../../src/engine/builders/middleware-builder';
import { type ModelDef } from '../../../../src/engine/types';

describe('MiddlewareBuilder', () => {
  it('should generate auth logic for actors', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        db: true,
        api: true,
        fields: { id: { type: 'Int', isRequired: true, isList: false, attributes: [], api: true } },
        actor: { name: 'user', prefix: 'sk_user', strategy: 'bearer' },
      },
    ];

    const builder = new MiddlewareBuilder(models);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const onRequest = sourceFile.getFunction('onRequest');
    expect(onRequest).toBeDefined();
    const body = onRequest?.getBodyText();
    expect(body).toContain('if (authHeader?.startsWith("Bearer sk_user"))');
    expect(body).toContain("context.locals.actor = { ...entity, type: 'user', role: 'USER' };");
  });
});
