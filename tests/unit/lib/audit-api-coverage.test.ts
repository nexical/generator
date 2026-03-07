/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditModule, auditApiModule } from '../../../src/lib/audit-api.js';
import { ModuleLocator } from '../../../src/lib/module-locator.js';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { BaseCommand } from '@nexical/cli-core';

vi.mock('../../../src/lib/module-locator.js');
vi.mock('node:fs');
vi.mock('node:path');

describe('AuditApi - Coverage Boost', () => {
  let mockCommand: BaseCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCommand = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    } as unknown as BaseCommand;
    // Default path mocks
    vi.mocked(path.join).mockImplementation((...args: any[]) => args.join('/'));
    vi.mocked(path.basename).mockImplementation((p: any) => String(p).split('/').pop() || '');
  });

  it('should report error if models.yaml is missing', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const issues = await auditModule(
      mockCommand,
      { name: 'test-api', path: '/test-api', app: 'backend' },
      false,
    );
    expect(issues[0]).toContain('models.yaml not found');
  });

  it('should report error if models.yaml fail to parse', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => String(p).endsWith('models.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: :');
    const issues = await auditModule(
      mockCommand,
      { name: 'test-api', path: '/test-api', app: 'backend' },
      false,
    );
    expect(issues[0]).toContain('Failed to parse models.yaml');
  });

  it('should validate models.yaml against Zod schema', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => String(p).endsWith('models.yaml'));
    // PrismaModelSchema requires 'fields'
    vi.mocked(fs.readFileSync).mockReturnValue('models: { User: {} }');
    const issues = await auditModule(
      mockCommand,
      { name: 'test-api', path: '/test-api', app: 'backend' },
      false,
    );
    expect(issues.some((i) => i.includes('models.yaml validation errors'))).toBe(true);
  });

  it('should report unknown types and roles in semantics check', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (String(p).endsWith('models.yaml')) return true;
      if (String(p).includes('/src/roles')) return false; // skip role scan for now
      return false;
    });

    const models = {
      models: {
        User: {
          fields: {
            name: 'String',
            age: 'UnknownType',
          },
          role: 'UNKNOWN_ROLE',
        },
      },
    };

    vi.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(models));

    const issues = await auditModule(
      mockCommand,
      { name: 'test-api', path: '/test-api', app: 'backend' },
      true,
    );
    expect(issues.some((i) => i.includes("unknown type 'UnknownType'"))).toBe(true);
    expect(issues.some((i) => i.includes("unknown role 'UNKNOWN_ROLE'"))).toBe(true);
  });

  it('should validate api.yaml semantics', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (String(p).endsWith('models.yaml')) return true;
      if (String(p).endsWith('api.yaml')) return true;
      return false;
    });

    const models = { models: { User: { fields: { name: 'String' } } } };
    const api = {
      User: [{ path: '/test', method: 'GET', verb: 'GET', input: 'UnknownInput' }],
    };

    vi.mocked(fs.readFileSync).mockImplementation((p: any) => {
      if (String(p).endsWith('models.yaml')) return YAML.stringify(models);
      if (String(p).endsWith('api.yaml')) return YAML.stringify(api);
      return '';
    });

    const issues = await auditModule(
      mockCommand,
      { name: 'test-api', path: '/test-api', app: 'backend' },
      true,
    );
    expect(issues.some((i) => i.includes("unknown input type 'UnknownInput'"))).toBe(true);
  });

  it('should handle auditApiModule with no modules found', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    await auditApiModule(mockCommand, 'non-existent', {});
    expect(mockCommand.warn).toHaveBeenCalledWith(expect.stringContaining('No modules found'));
  });

  it('should audit multiple modules correctly', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'api-1', path: '/api-1', app: 'backend' },
      { name: 'api-2', path: '/api-2', app: 'backend' },
    ]);

    vi.mocked(fs.existsSync).mockImplementation(
      (p: any) => String(p).includes('api-1') && String(p).endsWith('models.yaml'),
    );
    vi.mocked(fs.readFileSync).mockReturnValue('models: {}');

    await auditApiModule(mockCommand, 'api-*', {});
    expect(mockCommand.info).toHaveBeenCalledWith(
      expect.stringContaining('Auditing module: api-1'),
    );
    expect(mockCommand.info).toHaveBeenCalledWith(
      expect.stringContaining('Auditing module: api-2'),
    );
    expect(mockCommand.error).toHaveBeenCalled();
  });
});
