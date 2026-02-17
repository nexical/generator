/** @vitest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformParser } from '../../../src/core/parser';
import fs from 'fs';
import yaml from 'yaml';
import { PlatformDefinitionSchema } from '../../../src/schemas/api-schema';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));
vi.mock('yaml');
vi.mock('../../../src/schemas/api-schema', () => ({
  PlatformDefinitionSchema: {
    safeParse: vi.fn(),
  },
}));

describe('PlatformParser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(PlatformDefinitionSchema.safeParse).mockReturnValue({
      success: true,
      data: {},
    } as any);
  });

  it('should throw error if file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(() => PlatformParser.parseFile('missing.yaml')).toThrow('File not found');
  });

  it('should parse valid YAML and validate schema', () => {
    const mockYaml = { models: { User: { fields: { name: 'String' } } } };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('content');
    vi.mocked(yaml.parse).mockReturnValue(mockYaml);
    vi.mocked(PlatformDefinitionSchema.safeParse).mockReturnValue({
      success: true,
      data: mockYaml,
    } as any);

    const result = PlatformParser.parseFile('valid.yaml');
    expect(result).toEqual(mockYaml);
  });

  it('should throw error on validation failure', () => {
    const invalidYaml = { invalid: true };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('content');
    vi.mocked(yaml.parse).mockReturnValue(invalidYaml);
    vi.mocked(PlatformDefinitionSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [] },
    } as any);

    expect(() => PlatformParser.parseFile('invalid.yaml')).toThrow('Schema validation failed');
  });

  it('should parse module by looking for models.yaml', () => {
    const mockYaml = { models: {} };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('content');
    vi.mocked(yaml.parse).mockReturnValue(mockYaml);
    vi.mocked(PlatformDefinitionSchema.safeParse).mockReturnValue({
      success: true,
      data: mockYaml,
    } as any);

    PlatformParser.parseModule('/path/to/module');
    expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('models.yaml'));
  });
});
