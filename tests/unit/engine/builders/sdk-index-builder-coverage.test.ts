import { describe, it, expect } from 'vitest';
import { SdkIndexBuilder } from '../../../../src/engine/builders/sdk-index-builder.js';
import { Project } from 'ts-morph';
import { type ModelDef } from '../../../../src/engine/types.js';

describe('SdkIndexBuilder - Coverage Boost', () => {
  it('should handle module name without -api suffix', () => {
    const models: ModelDef[] = [];
    const builder = new SdkIndexBuilder(models, 'user');
    const schema = (builder as unknown as { getSchema(): Record<string, any> }).getSchema();
    expect(schema.classes[0].name).toBe('UserModule');
  });

  it('should handle default model for SDK extension', () => {
    const models: ModelDef[] = [
      { name: 'User', api: true, default: true, fields: {} } as unknown as ModelDef,
      { name: 'Team', api: true, fields: {} } as unknown as ModelDef,
    ];
    const builder = new SdkIndexBuilder(models, 'user-api');
    const schema = (builder as unknown as { getSchema(): Record<string, unknown> }).getSchema();

    expect((schema as { classes: { extends: string }[] }).classes[0].extends).toBe('BaseUserSDK');
    expect(
      (schema as { imports: { namedImports: string[] }[] }).imports.some(
        (i: { namedImports: string[] }) => i.namedImports.includes('ApiClient'),
      ),
    ).toBe(true);
    expect(
      (schema as { imports: { namedImports: string[] }[] }).imports.some(
        (i: { namedImports: string[] }) => i.namedImports.includes('BaseResource'),
      ),
    ).toBe(false);
  });

  it('should handle multiple roles and complex role names', () => {
    const roles = ['admin', 'team-member', 'project-viewer'];
    const builder = new SdkIndexBuilder([], 'test-api', roles);
    const schema = (builder as unknown as { getSchema(): any }).getSchema();

    const rolesInit = (
      (
        schema as { classes: { properties: { name: string; initializer: string }[] }[] }
      ).classes[0].properties.find((p: { name: string }) => p.name === 'roles') as {
        initializer: string;
      }
    ).initializer;
    expect(rolesInit).toContain("admin: 'admin'");
    expect(rolesInit).toContain("member: 'team-member'");
    expect(rolesInit).toContain("viewer: 'project-viewer'");
  });

  it('should handle ensure with existing class', () => {
    const project = new Project();
    const file = project.createSourceFile('test.ts', 'class TestModule {}');
    const builder = new SdkIndexBuilder([], 'test-api');

    // This should remove existing TestModule and add new one
    builder.ensure(file);

    expect(file.getClasses().length).toBe(1);
    expect(file.getClass('TestModule')).toBeDefined();
  });

  it('should filter extended models out of SDK index', () => {
    const models: ModelDef[] = [
      { name: 'User', api: true, default: true, fields: {} } as unknown as ModelDef,
      { name: 'Team', api: true, extended: true, fields: {} } as unknown as ModelDef,
    ];
    const builder = new SdkIndexBuilder(models, 'user-api');
    const schema = (builder as unknown as { getSchema(): any }).getSchema();

    expect(schema.classes[0].properties.length).toBe(1); // Only 'roles' property remains
    expect(schema.imports.length).toBe(2); // sdk-core + UserSDK
  });
});
