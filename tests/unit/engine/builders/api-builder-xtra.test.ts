import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { ApiBuilder } from '@nexical/generator/engine/builders/api-builder.js';
import { type ModelDef, type CustomRoute } from '@nexical/generator/engine/types.js';

describe('ApiBuilder Extra Coverage', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test-api.ts', '');
  });

  it('should handle generateSelectObject with no selectable fields', () => {
    const emptyModel: ModelDef = {
      name: 'Empty',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: false },
        secret: {
          type: 'String',
          isRequired: true,
          isList: false,
          attributes: [],
          api: true,
          private: true,
        },
      },
    };
    const builder = new ApiBuilder(emptyModel, [emptyModel], 'empty-api', 'collection');
    builder.ensure(sourceFile);
    expect(sourceFile.getFullText()).toContain('const select = {}');
  });

  it('should handle relation to model with NO private fields in select object', () => {
    const publicModel: ModelDef = {
      name: 'Public',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
        name: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
      },
    };
    const relationModel: ModelDef = {
      name: 'Relation',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
        pub: {
          type: 'Public',
          isRequired: true,
          isList: false,
          attributes: [],
          api: true,
          isRelation: true,
          relationTo: 'Public',
        },
      },
    };
    const builder = new ApiBuilder(
      relationModel,
      [relationModel, publicModel],
      'rel-api',
      'collection',
    );
    builder.ensure(sourceFile);
    // Should NOT have select inside pub because Public has no private fields
    expect(sourceFile.getFullText()).toContain('pub: true');
  });

  it('should handle custom route with explicitly null/void input and enum in output models', () => {
    const model: ModelDef = {
      name: 'User',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
        status: {
          type: 'Status',
          isRequired: true,
          isList: false,
          attributes: [],
          api: true,
          isEnum: true,
          enumValues: ['ACTIVE', 'INACTIVE'],
        },
      },
    };
    const routes: CustomRoute[] = [
      {
        method: 'ping',
        path: '/ping',
        verb: 'GET',
        input: 'none',
        output: 'User',
      },
    ];
    const builder = new ApiBuilder(model, [model], 'user-api', 'custom', routes);
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();
    expect(text).toContain('zodSchema = null');
    expect(text).toContain('status');
  });

  it('should handle IndividualSchema with missing model reference in custom route', () => {
    const model: ModelDef = {
      name: 'User',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
      },
    };
    const routes: CustomRoute[] = [
      {
        method: 'weird',
        path: '/weird',
        verb: 'POST',
        input: 'MissingModel',
        output: 'void',
      },
    ];
    const builder = new ApiBuilder(model, [model], 'user-api', 'custom', routes);
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();
    // input type should still be generated but zodSchema defaults to z.unknown() if model missing
    expect(text).toContain('zodSchema = ');
    expect(text).toContain('z.unknown()');
  });
});
