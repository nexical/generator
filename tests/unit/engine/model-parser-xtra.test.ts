/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { ModelParser } from '../../../src/engine/model-parser.js';
import path from 'node:path';
import * as fs from 'node:fs';
import os from 'node:os';

describe('ModelParser - Enhanced Coverage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `model-parser-cov-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  it('should handle missing models.yaml gracefully', () => {
    const result = ModelParser.parse(path.join(tmpDir, 'missing.yaml'));
    expect(result.models).toEqual([]);
    expect(result.enums).toEqual([]);
  });

  it('should parse complex enum with values object', () => {
    const yaml = `
enums:
  Status:
    values: [active, inactive]
models:
  User:
    fields:
      status: Status
`;
    const p = path.join(tmpDir, 'models.yaml');
    fs.writeFileSync(p, yaml);
    const result = ModelParser.parse(p);
    expect(result.enums[0].members.map((m) => m.name)).toEqual(['active', 'inactive']);
    expect(result.models[0].fields.status.enumValues).toEqual(['active', 'inactive']);
  });

  it('should handle enum as plain record', () => {
    const yaml = `
enums:
  Role:
    ADMIN: admin
    USER: user
models:
  User:
    fields:
      role: Role
`;
    const p = path.join(tmpDir, 'models.yaml');
    fs.writeFileSync(p, yaml);
    const result = ModelParser.parse(p);
    expect(result.enums[0].members.map((m) => m.name)).toEqual(['ADMIN', 'USER']);
    expect(result.models[0].fields.role.enumValues).toEqual(['ADMIN', 'USER']);
  });

  it('should handle complex object enum', () => {
    const yaml = `
enums:
  Complexity:
    V1: { value: 'v1' }
    V2: { value: 'v2' }
models:
  User:
    fields:
      comp: Complexity
`;
    const p = path.join(tmpDir, 'complex.yaml');
    fs.writeFileSync(p, yaml);
    const result = ModelParser.parse(p);
    expect(result.enums[0].members.map((m) => m.name)).toEqual(['V1', 'V2']);
  });
});
