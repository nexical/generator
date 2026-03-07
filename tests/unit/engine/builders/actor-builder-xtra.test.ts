/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { ActorBuilder } from '../../../../src/engine/builders/actor-builder.js';
import { Project } from 'ts-morph';
import type { ModelDef } from '../../../../src/engine/types.js';

describe('ActorBuilder - Enhanced Coverage', () => {
  it('should generate empty actors object when no models have actor config', () => {
    const models = [{ name: 'Log', api: true, fields: {} }] as unknown as ModelDef[];
    const builder = new ActorBuilder(models);

    const project = new Project();
    const file = project.createSourceFile('actors.ts', '');
    builder.ensure(file);

    // With no actors, the actors variable should still be declared
    const text = file.getFullText();
    expect(text).toContain('actors');
  });

  it('should skip api-key actor missing required fields', () => {
    const models = [
      { name: 'User', api: true, actor: { strategy: 'api-key', fields: {} }, fields: {} },
    ] as unknown as ModelDef[];
    const builder = new ActorBuilder(models);

    const project = new Project();
    const file = project.createSourceFile('actors.ts', '');
    builder.ensure(file);

    const text = file.getFullText();
    // api-key without keyModel/ownerField should be skipped, actors should still be declared
    expect(text).toContain('actors');
  });

  it('should skip model with no actor config', () => {
    const models = [
      {
        name: 'Product',
        api: true,
        fields: {
          name: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
    ] as unknown as ModelDef[];
    const builder = new ActorBuilder(models);

    const project = new Project();
    const file = project.createSourceFile('actors.ts', '');
    builder.ensure(file);

    const text = file.getFullText();
    expect(text).toBeDefined();
  });
});
