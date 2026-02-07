/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelParser } from '@nexical/generator/engine/model-parser';
import fs from 'fs';

const mocks = vi.hoisted(() => {
  return {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

vi.mock('fs', () => {
  return {
    default: mocks,
    ...mocks,
  };
});

vi.mock('node:fs', () => {
  return {
    default: mocks,
    ...mocks,
  };
});

describe('ModelParser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should handle missing API and test configs gracefully', () => {
    const raw = {
      models: {
        User: {
          fields: { id: 'String' },
        },
      },
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(raw)); // Yaml parser handles JSON too
    const result = ModelParser.parse('test.yaml');
    expect(result.models[0].api).toBe(true); // Default is true
    expect(result.models[0].test).toBeUndefined();
  });

  it('should return empty results if file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = ModelParser.parse('non-existent.yaml');
    expect(result.models).toEqual([]);
    expect(result.enums).toEqual([]);
    expect(result.config).toEqual({});
  });

  it('should parse models and enums correctly', () => {
    const yamlContent = `
enums:
  Status: [ACTIVE, INACTIVE]
models:
  User:
    api: true
    fields:
      email: String
      status: Status
  Post:
    fields:
      title: String
      author: User
`;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

    const result = ModelParser.parse('models.yaml');

    expect(result.enums).toHaveLength(1);
    expect(result.enums[0].name).toBe('Status');
    expect(result.enums[0].members).toHaveLength(2);

    expect(result.models).toHaveLength(2);
    const user = result.models.find((m) => m.name === 'User');
    expect(user).toBeDefined();
    expect(user?.fields.email.type).toBe('String');
    expect(user?.fields.status.isEnum).toBe(true);
    expect(user?.fields.status.enumValues).toEqual(['ACTIVE', 'INACTIVE']);

    const post = result.models.find((m) => m.name === 'Post');
    expect(post?.fields.author.isRelation).toBe(true);
    expect(post?.fields.author.relationTo).toBe('User');
  });

  it('should handle complex field configurations', () => {
    const yamlContent = `
models:
  Product:
    fields:
      price:
        type: Float
        isRequired: false
      tags:
        type: String
        isList: true
`;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

    const result = ModelParser.parse('models.yaml');
    const product = result.models[0];

    expect(product.fields.price.isRequired).toBe(false);
    expect(product.fields.tags.isList).toBe(true);
  });

  it('should parse enums defined as records', () => {
    const yamlContent = `
enums:
  Role:
    values: [ADMIN, USER]
`;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

    const result = ModelParser.parse('models.yaml');
    expect(result.enums[0].members).toHaveLength(2);
  });

  it('should parse enums defined as objects without values property', () => {
    const yamlContent = `
enums:
  Priority:
    HIGH: high
    LOW: low
`;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

    const result = ModelParser.parse('models.yaml');
    expect(result.enums[0].members).toHaveLength(2);
    expect(result.enums[0].members.some((m) => m.name === 'HIGH')).toBe(true);
  });

  it('should handle diverse enum field values', () => {
    const yamlContent = `
enums:
  E1: [A, B]
  E2: { values: [C, D] }
  E3: { K1: V1 }
models:
  M:
    fields:
      f1: E1
      f2: E2
      f3: E3
`;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

    const result = ModelParser.parse('models.yaml');
    expect(result.models[0].fields.f1.enumValues).toEqual(['A', 'B']);
    expect(result.models[0].fields.f2.enumValues).toEqual(['C', 'D']);
    expect(result.models[0].fields.f3.enumValues).toEqual(['K1']);
  });
});
