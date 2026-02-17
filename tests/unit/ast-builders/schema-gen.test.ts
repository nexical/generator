/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { ZodSchemaGenerator } from '../../../src/ast-builders/schema-gen';
import { type PlatformDefinition } from '../../../src/schemas/api-schema';

describe('ZodSchemaGenerator', () => {
  const printer = ts.createPrinter();

  it('should generate a full source file with enums and models', () => {
    const definition: PlatformDefinition = {
      enums: {
        Status: { values: ['ACTIVE', 'INACTIVE'] },
      },
      models: {
        User: {
          fields: {
            id: 'String',
            email: 'String',
            age: { type: 'Int', isRequired: false },
            posts: 'Post[]',
            role: 'Status',
          },
        },
      },
    };

    const sourceFile = ZodSchemaGenerator.generate(definition);
    const result = printer.printFile(sourceFile);

    expect(result).toContain('import { z } from "zod"');
    expect(result).toContain('export const StatusSchema = z.enum(["ACTIVE", "INACTIVE"])');
    expect(result).toContain('export const UserSchema = z.object({');
    expect(result).toContain('id: z.string()');
    expect(result).toContain('email: z.string()');
    expect(result).toContain('age: z.number().optional()');
    expect(result).toContain('posts: z.lazy(() => PostSchema).array()');
    expect(result).toContain('role: z.lazy(() => StatusSchema)');
  });

  it('should handle different basic types', () => {
    const definition: PlatformDefinition = {
      models: {
        AllTypes: {
          fields: {
            str: 'String',
            num: 'Int',
            bool: 'Boolean',
            date: 'DateTime',
            json: 'Json',
          },
        },
      },
    };

    const sourceFile = ZodSchemaGenerator.generate(definition);
    const result = printer.printFile(sourceFile);

    expect(result).toContain('str: z.string()');
    expect(result).toContain('num: z.number()');
    expect(result).toContain('bool: z.boolean()');
    expect(result).toContain('date: z.date()');
    expect(result).toContain('json: z.any()');
  });

  it('should handle shorthand optional and list types', () => {
    const definition: PlatformDefinition = {
      models: {
        Shorthand: {
          fields: {
            optStr: 'String?',
            listNum: 'Int[]',
            optList: 'String[]?',
            explicitList: { type: 'String[]' },
          },
        },
      },
    };

    const sourceFile = ZodSchemaGenerator.generate(definition);
    const result = printer.printFile(sourceFile);

    expect(result).toContain('optStr: z.string().optional()');
    expect(result).toContain('listNum: z.number().array()');
    expect(result).toContain('optList: z.string().array().optional()');
    expect(result).toContain('explicitList: z.string().array()');
  });
});
