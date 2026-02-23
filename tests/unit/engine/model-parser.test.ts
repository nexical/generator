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

  it('should ignore empty model names in record', () => {
    const raw = {
      models: {
        '': { fields: {} },
        User: { fields: { email: 'String' } },
      },
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(raw));

    const result = ModelParser.parse('test.yaml');
    expect(result.models.length).toBe(1);
    expect(result.models[0].name).toBe('User');
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
    expect(result.models).toHaveLength(2);
  });
});
