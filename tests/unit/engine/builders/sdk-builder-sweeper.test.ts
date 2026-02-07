/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { SdkBuilder } from '../../../../src/engine/builders/sdk-builder';
import {
  type ModelDef,
  type CustomRoute,
  type FileDefinition,
  type ImportConfig,
  type ParsedStatement,
} from '../../../../src/engine/types';

describe('SdkBuilder Sweeper', () => {
  const getMethods = (file: FileDefinition) => {
    const cls = file.classes?.[0];
    return cls?.methods?.map((m) => m.name) || [];
  };

  it('should generate full CRUD for string role', () => {
    const model: ModelDef = {
      name: 'User',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
      },
      role: 'member', // String config
    };
    const builder = new SdkBuilder(model);
    const file = (builder as unknown as { getSchema: () => FileDefinition }).getSchema();

    const methods = getMethods(file);
    expect(methods).toContain('list');
    expect(methods).toContain('get');
    expect(methods).toContain('create');
    expect(methods).toContain('update');
    expect(methods).toContain('delete');
  });

  it('should respect role object configuration (hide methods)', () => {
    const model: ModelDef = {
      name: 'ReadOnly',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
      },
      role: {
        list: 'public',
        get: 'public',
        create: 'none',
        update: 'none',
        delete: 'none',
      },
    };
    const builder = new SdkBuilder(model);
    const file = (builder as unknown as { getSchema: () => FileDefinition }).getSchema();

    const methods = getMethods(file);
    expect(methods).toContain('list');
    expect(methods).toContain('get');
    expect(methods).not.toContain('create');
    expect(methods).not.toContain('update');
    expect(methods).not.toContain('delete');
  });

  it('should skip CRUD for virtual models (db: false)', () => {
    const model: ModelDef = {
      name: 'Virtual',
      api: true,
      db: false,
      fields: {},
    };
    const builder = new SdkBuilder(model);
    const file = (builder as unknown as { getSchema: () => FileDefinition }).getSchema();

    const methods = getMethods(file);
    expect(methods).toHaveLength(0);
  });

  it('should generate custom routes with params and types', () => {
    const model: ModelDef = {
      name: 'Process',
      api: true,
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
      },
    };
    const routes: CustomRoute[] = [
      {
        method: 'runAction',
        path: '/run/[actionId]',
        verb: 'POST',
        input: 'ActionInput', // Custom type
        output: 'Process', // Entity type
      },
      {
        method: 'getStatus',
        path: '/status',
        verb: 'GET',
        output: 'StatusEnum', // Custom type
      },
    ];

    const builder = new SdkBuilder(model, routes);
    const file = (builder as unknown as { getSchema: () => FileDefinition }).getSchema();
    const methods = getMethods(file);

    // Check methods exist
    expect(methods).toContain('runAction');
    expect(methods).toContain('getStatus');

    // Check imports for custom types
    const typeImport = file.imports?.find((i: ImportConfig) => i.moduleSpecifier === './types.js');
    expect(typeImport).toBeDefined();
    // Should include 'ActionInput', 'StatusEnum'.
    // Should NOT include 'Process' (Entity type handled separately) or 'any'.
    expect(typeImport?.namedImports).toContain('ActionInput');
    expect(typeImport?.namedImports).toContain('StatusEnum');

    // Verify path param replacement logic
    const cls = file.classes?.[0];
    const runMethod = cls?.methods?.find((m) => m.name === 'runAction');
    const statement = runMethod?.statements?.[0];
    const rawContent =
      typeof statement === 'string' ? statement : (statement as ParsedStatement)?.raw || '';
    // Expect template literal with ${actionId} and resolved endpoint 'process'
    expect(rawContent).toContain('`/process/run/${actionId}`');
  });
});
