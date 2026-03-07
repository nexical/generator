/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { ZodHelper } from '../../../../../src/engine/builders/utils/zod-helper.js';
import { type ModelDef } from '../../../../../src/engine/types.js';

describe('ZodHelper - generateSchema coverage', () => {
  const makeModel = (fields: Record<string, Partial<ModelDef['fields'][string]>>): ModelDef =>
    ({
      name: 'Test',
      fields: Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [
          k,
          {
            type: 'String',
            isRequired: true,
            isList: false,
            isRelation: false,
            isEnum: false,
            ...v,
          },
        ]),
      ),
    }) as unknown as ModelDef;

  it('should generate schema for empty model', () => {
    const model = makeModel({});
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toBe('z.object({})');
  });

  it('should skip system fields like createdAt, updatedAt', () => {
    const model = makeModel({
      id: { type: 'String', attributes: ['@default(cuid())'] },
      createdAt: { type: 'DateTime' },
      updatedAt: { type: 'DateTime' },
      name: { type: 'String' },
    });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('name');
    expect(result).not.toContain('createdAt');
    expect(result).not.toContain('updatedAt');
  });

  it('should generate Int validator', () => {
    const model = makeModel({ count: { type: 'Int', isRequired: true } });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('z.number().int()');
  });

  it('should generate Float validator', () => {
    const model = makeModel({ price: { type: 'Float', isRequired: true } });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('z.number()');
  });

  it('should generate Decimal validator', () => {
    const model = makeModel({ price: { type: 'Decimal', isRequired: true } });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('z.number()');
  });

  it('should generate Boolean validator', () => {
    const model = makeModel({ active: { type: 'Boolean', isRequired: true } });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('z.boolean()');
  });

  it('should generate DateTime validator', () => {
    const model = makeModel({ startDate: { type: 'DateTime', isRequired: true } });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('z.union');
  });

  it('should generate Json validator', () => {
    const model = makeModel({ meta: { type: 'Json', isRequired: true } });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('z.unknown()');
  });

  it('should add .email() for email field', () => {
    const model = makeModel({ email: { type: 'String', isRequired: true } });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('.email()');
  });

  it('should make optional/nullable for non-required fields', () => {
    const model = makeModel({ bio: { type: 'String', isRequired: false } });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('.optional().nullable()');
  });

  it('should generate enum validator with values', () => {
    const model = makeModel({
      status: {
        type: 'Status',
        isEnum: true,
        isRequired: true,
        enumValues: ['active', 'inactive'],
      },
    });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain("z.enum(['active', 'inactive'])");
  });

  it('should generate nativeEnum for enum without values', () => {
    const model = makeModel({
      status: { type: 'Status', isEnum: true, isRequired: true },
    });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('z.nativeEnum(Status)');
  });

  it('should wrap list fields in z.array', () => {
    const model = makeModel({
      tags: { type: 'String', isRequired: true, isList: true },
    });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('z.array(z.string())');
  });

  it('should skip relation fields', () => {
    const model = makeModel({
      posts: { type: 'Post', isRelation: true, isRequired: false },
    });
    const allModels = [{ name: 'Post', fields: {} }] as ModelDef[];
    const result = ZodHelper.generateSchema(model, allModels);
    expect(result).not.toContain('posts');
  });

  it('should include explicitly-specified include fields', () => {
    const model = makeModel({
      id: { type: 'String', attributes: ['@default(cuid())'], isRequired: true },
    });
    // id is normally excluded, but this time we include it
    const result = ZodHelper.generateSchema(model, [], ['id']);
    expect(result).toContain('id');
  });

  it('should skip fields with api: false', () => {
    const model = makeModel({
      secret: { type: 'String', api: false, isRequired: true },
    });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).not.toContain('secret');
  });

  it('should skip private fields', () => {
    const model = makeModel({
      internalNote: { type: 'String', private: true, isRequired: true },
    });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).not.toContain('internalNote');
  });

  it('should make @default fields optional/nullable', () => {
    const model = makeModel({
      slug: { type: 'String', isRequired: true, attributes: ['@default(cuid())'] },
    });
    const result = ZodHelper.generateSchema(model, []);
    expect(result).toContain('.optional().nullable()');
  });
});
