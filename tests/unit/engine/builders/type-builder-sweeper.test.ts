/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { TypeBuilder } from '../../../../src/engine/builders/type-builder';
import {
  type ModelDef,
  type FileDefinition,
  type ExportConfig,
  type InterfaceConfig,
  type PropertyConfig,
} from '../../../../src/engine/types';

describe('TypeBuilder Sweeper', () => {
  it('should generate Prisma client exports for DB models', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        api: true,
        db: true,
        fields: {
          id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
        },
      },
    ];
    const builder = new TypeBuilder(models);
    const file = (builder as unknown as { getSchema: () => FileDefinition }).getSchema();

    const prismaExport = file.exports?.find(
      (e: ExportConfig) => e.moduleSpecifier === '@prisma/client',
    );
    expect(prismaExport).toBeDefined();
    expect(prismaExport?.exportClause).toContain('User');
  });

  it('should generate Interfaces for Virtual models', () => {
    const models: ModelDef[] = [
      {
        name: 'Virtual',
        api: true,
        db: false,
        fields: {
          id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
          count: { type: 'Int', isRequired: true, isList: false, attributes: [], api: true },
          tags: { type: 'String', isRequired: true, isList: true, attributes: [], api: true },
        },
      },
    ];
    const builder = new TypeBuilder(models);
    const file = (builder as unknown as { getSchema: () => FileDefinition }).getSchema();

    const iface = file.interfaces?.find((i: InterfaceConfig) => i.name === 'Virtual');
    expect(iface).toBeDefined();
    expect(iface?.properties).toBeDefined();
    expect(iface?.properties?.find((p: PropertyConfig) => p.name === 'id')?.type).toBe('string');
    expect(iface?.properties?.find((p: PropertyConfig) => p.name === 'count')?.type).toBe('number');
    expect(iface?.properties?.find((p: PropertyConfig) => p.name === 'tags')?.type).toBe(
      'string[]',
    );
  });

  it('should generate Enum types', () => {
    const enums = [{ name: 'Role', members: [{ name: 'ADMIN', value: 'ADMIN' }] }];
    const builder = new TypeBuilder([], enums);
    const file = (builder as unknown as { getSchema: () => FileDefinition }).getSchema();

    const enumsResult = file.enums || [];
    expect(enumsResult).toHaveLength(1);
    expect(enumsResult[0].name).toBe('Role');
    expect(enumsResult[0].members).toContainEqual({ name: 'ADMIN', value: 'ADMIN' });
  });
});
