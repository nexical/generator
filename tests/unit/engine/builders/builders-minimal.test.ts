import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ApiBuilder } from '../../../../src/engine/builders/api-builder.js';
import { SdkBuilder } from '../../../../src/engine/builders/sdk-builder.js';
import { InitBuilder } from '../../../../src/engine/builders/init-builder.js';
import { TestBuilder } from '../../../../src/engine/builders/test-builder.js';
import { type ModelDef } from '../../../../src/engine/types.js';

describe('Builders Minimal Coverage', () => {
  const project = new Project({ useInMemoryFileSystem: true });
  const mockModel = {
    name: 'User',
    fields: { id: { type: 'String', api: true } },
    db: true,
    role: 'member',
  };
  const mockAllModels = [mockModel] as unknown as ModelDef[];

  it('ApiBuilder should hit branches (collection)', () => {
    const builder = new ApiBuilder(
      mockModel as unknown as ModelDef,
      mockAllModels,
      'test-api',
      'collection',
    );
    const file = project.createSourceFile('api-coll.ts', '');
    builder.ensure(file);
    expect(file.getFullText()).toContain('export const GET');
    expect(file.getFullText()).toContain('export const POST');
  });

  it('ApiBuilder should hit branches (individual)', () => {
    const builder = new ApiBuilder(
      mockModel as unknown as ModelDef,
      mockAllModels,
      'test-api',
      'individual',
    );
    const file = project.createSourceFile('api-ind.ts', '');
    builder.ensure(file);
    expect(file.getFullText()).toContain('export const GET');
    expect(file.getFullText()).toContain('export const PUT');
    expect(file.getFullText()).toContain('export const DELETE');
  });

  it('ApiBuilder should hit branches (custom)', () => {
    const customRoutes = [{ method: 'doSomething', verb: 'POST', path: '/do', role: 'admin' }];
    const builder = new ApiBuilder(
      mockModel as unknown as ModelDef,
      mockAllModels,
      'test-api',
      'custom',
      customRoutes as unknown as import('../../../../src/engine/types.js').CustomRoute[],
    );
    const file = project.createSourceFile('api-custom.ts', '');
    builder.ensure(file);
    expect(file.getFullText()).toContain('export const POST');
  });

  it('SdkBuilder should hit branches', () => {
    const builder = new SdkBuilder(mockModel as unknown as ModelDef, []);
    const file = project.createSourceFile('sdk.ts', '');
    builder.ensure(file);
    expect(file.getFullText()).toContain('export class');
  });

  it('InitBuilder should hit branches', () => {
    const builder = new InitBuilder('server');
    const file = project.createSourceFile('init.ts', '');
    builder.ensure(file);
    expect(file.getFullText()).toContain('init');
  });

  it('TestBuilder should hit branches', () => {
    const builder = new TestBuilder(mockModel as unknown as ModelDef, 'test-api', 'create');
    const file = project.createSourceFile('user.test.ts', '');
    builder.ensure(file);
    expect(file.getFullText()).toContain('describe');
  });
});
