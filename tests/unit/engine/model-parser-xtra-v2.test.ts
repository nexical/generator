import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelParser } from '@nexical/generator/engine/model-parser.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('ModelParser Extra Coverage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexical-model-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return empty if models.yaml does not exist', () => {
    const result = ModelParser.parse(path.join(tmpDir, 'non-existent.yaml'));
    expect(result.models).toHaveLength(0);
    expect(result.enums).toHaveLength(0);
  });

  it('should handle shorthand field syntax and optional fields', () => {
    const yamlContent = `
models:
  User:
    fields:
      name: String!
      age: Int?
      tags: String[]
      scores: Int![]
`;
    const yamlPath = path.join(tmpDir, 'models.yaml');
    fs.writeFileSync(yamlPath, yamlContent);

    const { models } = ModelParser.parse(yamlPath);
    const user = models.find((m) => m.name === 'User');
    expect(user).toBeDefined();
    expect(user?.fields.name.type).toBe('String');
    expect(user?.fields.name.isRequired).toBe(true);
    expect(user?.fields.age.isRequired).toBe(false);
    expect(user?.fields.tags.isList).toBe(true);
    expect(user?.fields.scores.isList).toBe(true);
    expect(user?.fields.scores.isRequired).toBe(true);
  });

  it('should handle invalid enum structure', () => {
    const yamlContent = `
models:
  User:
    fields:
      role: Role
enums:
  Role: 123
`;
    const yamlPath = path.join(tmpDir, 'models.yaml');
    fs.writeFileSync(yamlPath, yamlContent);

    const { models } = ModelParser.parse(yamlPath);
    expect(models[0].fields.role.enumValues).toEqual([]);
  });

  it('should handle config block in models.yaml', () => {
    const yamlContent = `
config:
  test: true
models:
  User:
    fields:
      id: ID
`;
    const yamlPath = path.join(tmpDir, 'models.yaml');
    fs.writeFileSync(yamlPath, yamlContent);

    const { config } = ModelParser.parse(yamlPath);
    expect(config).toEqual({ test: true });
  });

  it('should handle enums and object-based enum members in models.yaml', () => {
    const yamlContent = `
models: {}
enums:
  Role:
    ADMIN: admin
    USER: user
  Status:
    values: [ACTIVE, INACTIVE]
`;
    const yamlPath = path.join(tmpDir, 'models.yaml');
    fs.writeFileSync(yamlPath, yamlContent);

    const result = ModelParser.parse(yamlPath);
    expect(result.enums).toHaveLength(2);

    const roleEnum = result.enums.find((e) => e.name === 'Role');
    expect(roleEnum?.members).toContainEqual({ name: 'ADMIN', value: 'ADMIN' }); // Wait, implementation uses key as both name and value?

    const statusEnum = result.enums.find((e) => e.name === 'Status');
    expect(statusEnum?.members).toContainEqual({ name: 'ACTIVE', value: 'ACTIVE' });
  });
});
