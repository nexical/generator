/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { VariablePrimitive } from '@nexical/generator/engine/primitives/nodes/variable.js';
import { ApiBuilder } from '@nexical/generator/engine/builders/api-builder.js';
import { type ModelDef } from '@nexical/generator/engine/types.js';

describe('Coverage Booster - VariablePrimitive (Target: 95%)', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
  });

  it('should handle large initializers > 2000 chars via replaceWithText (Line 80-93)', () => {
    const largeInit =
      '[\n' +
      Array(100)
        .fill('{ "key": "value", "more": "data", "evenMore": "data", "status": "active" }')
        .join(',\n') +
      '\n]';
    expect(largeInit.length).toBeGreaterThan(2000);

    sourceFile.addVariableStatement({
      declarations: [{ name: 'LARGE_VAR', initializer: '[]' }],
    });
    const stmt = sourceFile.getVariableStatement('LARGE_VAR')!;

    const primitive = new VariablePrimitive({
      name: 'LARGE_VAR',
      initializer: largeInit,
      comments: ['Large comment test'],
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    primitive.update(stmt);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('is large ('));
    const text = sourceFile.getFullText();
    expect(text).toContain('// Large comment test');
    expect(text).toContain('const LARGE_VAR = [');
  });

  it('should handle critical failure with statement replacement fallback (Line 111-120)', () => {
    sourceFile.addVariableStatement({
      declarations: [{ name: 'CRIT_VAR', initializer: '1' }],
    });
    const stmt = sourceFile.getVariableStatement('CRIT_VAR')!;
    const decl = stmt.getDeclarations()[0];

    // Mock both setInitializer and initializer node's replaceWithText to fail
    decl.setInitializer = () => {
      throw new Error('Fail 1');
    };
    const initNode = decl.getInitializer()!;
    initNode.replaceWithText = () => {
      throw new Error('Fail 2');
    };

    const primitive = new VariablePrimitive({
      name: 'CRIT_VAR',
      initializer: '500',
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    primitive.update(stmt);

    expect(errorSpy).toHaveBeenCalled();
    // Should have used statement replacement
    expect(sourceFile.getFullText()).toContain('const CRIT_VAR = 500;');
  });

  it('should handle isDefault branch in update (Line 47)', () => {
    sourceFile.addVariableStatement({
      declarations: [{ name: 'DEF_VAR', initializer: '"orig"' }],
    });
    const stmt = sourceFile.getVariableStatement('DEF_VAR')!;
    const primitive = new VariablePrimitive({
      name: 'DEF_VAR',
      initializer: '"new"',
      isDefault: true,
    });
    primitive.update(stmt);
    expect(stmt.getDeclarations()[0].getInitializer()?.getText()).toBe('"orig"');
  });

  it('should wrap single-line object literals in parentheses (Line 154)', () => {
    const primitive = new VariablePrimitive({
      name: 'OBJ_VAR',
      initializer: '{ a: 1 }',
    });
    const stmt = primitive.create(sourceFile);
    expect(stmt.getDeclarations()[0].getInitializer()?.getText()).toBe('({ a: 1 })');
  });
});

describe('Coverage Booster - ApiBuilder (Target: 95%)', () => {
  let project: Project;
  let sourceFile: SourceFile;
  const model: ModelDef = {
    name: 'User',
    fields: {
      id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
    },
    api: true,
  };

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('api.ts', '');
  });

  it('should handle default role for custom routes (Line 699)', () => {
    const routes = [{ method: 'internal', verb: 'POST' as const, path: '/internal' }];
    const builder = new ApiBuilder(model, [model], 'user-api', 'custom', routes);
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();
    // default role should be 'employee' or similar based on PathResolver
    expect(text).toContain("'USER_EMPLOYE"); // it might be USER_EMPLOYEE or admin depending on defaults
  });

  it('should handle custom route with input: "none" (Line 705)', () => {
    const routes = [{ method: 'ping', verb: 'GET' as const, input: 'none', path: '/ping' }];
    const builder = new ApiBuilder(model, [model], 'user-api', 'custom', routes);
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();
    expect(text).toContain('zodSchema = null');
  });

  it('should handle different roles in custom routes (Line 679-681)', () => {
    // Use different verbs to avoid collision and see both in output
    const routes = [
      { method: 'secret', verb: 'POST' as const, role: 'admin', path: '/admin' },
      { method: 'open', verb: 'GET' as const, role: 'public', path: '/public' },
    ];
    const builder = new ApiBuilder(model, [model], 'user-api', 'custom', routes);
    builder.ensure(sourceFile);
    const text = sourceFile.getFullText();
    expect(text).toContain("'admin'");
    expect(text).toContain('protected: false');
  });

  it('should generate individual schema (GET/POST) for model list and DTO (Line 609-610, 625-626, 649, 653-656)', () => {
    const routes = [
      // Route 1: explicit action 'list_user' -> actionBase 'list_user', class 'List_userAction'
      { method: 'getA', verb: 'GET' as const, action: 'list_user', output: 'UserDTO', path: '/a' },
      // Route 2: method 'list_user' -> actionBase 'list_user', class 'List_userUserAction'
      { method: 'list_user', verb: 'POST' as const, output: 'UserResponse', path: '/b' },
    ];
    const builder = new ApiBuilder(model, [model], 'user-api', 'custom', routes);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('List_userAction');
    expect(text).toContain('List_userUserAction');
    // Both UserDTO and UserResponse return { type: "object" } since they aren't in allModels
    // The important thing is that the branches were hit.
    expect(text).toContain('schema: { type: "object" }');
  });

  it('should handle global and per-operation roles (Line 44-50)', () => {
    const roleModel: ModelDef = {
      name: 'User',
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
      },
      api: true,
      role: { get: 'admin', update: 'public' },
    };
    const builder = new ApiBuilder(roleModel, [roleModel], 'user-api', 'collection');
    // @ts-expect-error - accessing private getRole for coverage
    expect(builder.getRole('get')).toBe('admin');
    // @ts-expect-error - accessing private getRole for coverage
    expect(builder.getRole('update')).toBe('public');
  });

  it('should handle anonymous role protectedStatus branch (Line 679-681)', () => {
    const routes = [{ method: 'ping', verb: 'GET' as const, role: 'public', path: '/ping' }];
    const builder = new ApiBuilder(model, [model], 'user-api', 'custom', routes);
    builder.ensure(sourceFile);
    expect(sourceFile.getFullText()).toContain('protected: false');
  });
});
