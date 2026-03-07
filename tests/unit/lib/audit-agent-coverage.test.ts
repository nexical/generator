import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditAgentModule } from '../../../src/lib/audit-agent.js';
import { ModuleLocator } from '../../../src/lib/module-locator.js';
import fs from 'node:fs';
import YAML from 'yaml';
import type { BaseCommand } from '@nexical/cli-core';

vi.mock('node:fs');
vi.mock('../../../src/lib/module-locator.js');

describe('AuditAgent - Coverage Boost', () => {
  let mockCommand: BaseCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCommand = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    } as unknown as BaseCommand;
  });

  it('should handle no modules found', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    await auditAgentModule(mockCommand, 'pattern', {});
    expect(mockCommand.warn).toHaveBeenCalledWith(expect.stringContaining('No modules found'));
  });

  it('should report missing agents.yaml', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test-api', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await auditAgentModule(mockCommand, 'test-api', { verbose: true });
    expect(mockCommand.info).toHaveBeenCalledWith(expect.stringMatching(/No agents.yaml found/));
  });

  it('should validate invalid agents.yaml schema', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test-api', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('agents: [{ name: "Test", type: "invalid" }]');

    await auditAgentModule(mockCommand, 'test-api', {});
    expect(mockCommand.info).toHaveBeenCalledWith(
      expect.stringContaining('Schema validation issues'),
    );
  });

  it('should handle legacy YAML format (key-value pairs)', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test-api', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const legacyYaml = YAML.stringify({
      Collector: { type: 'persistent', description: 'desc' },
    });
    vi.mocked(fs.readFileSync).mockReturnValue(legacyYaml);

    await auditAgentModule(mockCommand, 'test-api', { schema: true });
    expect(mockCommand.success).toHaveBeenCalledWith(
      expect.stringContaining('Schema valid (1 agents)'),
    );
  });

  it('should validate job agent implementation', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test-api', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (String(p).endsWith('agents.yaml')) return true;
      if (String(p).includes('src/agent/MyJob.ts')) return true;
      return false;
    });

    const yaml = YAML.stringify({
      agents: [{ name: 'MyJob', type: 'job' }],
    });
    vi.mocked(fs.readFileSync).mockImplementation((p: any) => {
      if (String(p).endsWith('agents.yaml')) return yaml;
      return 'class MyJob { /* missing JobProcessor */ }';
    });

    await auditAgentModule(mockCommand, 'test-api', {});
    expect(mockCommand.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid JobProcessor implementation'),
    );
  });

  it('should validate persistent agent implementation', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test-api', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (String(p).endsWith('agents.yaml')) return true;
      if (String(p).includes('src/agent/MyPersistent.ts')) return true;
      return false;
    });

    const yaml = YAML.stringify({
      agents: [{ name: 'MyPersistent', type: 'persistent' }],
    });
    vi.mocked(fs.readFileSync).mockImplementation((p: any) => {
      if (String(p).endsWith('agents.yaml')) return yaml;
      return 'class MyPersistent extends PersistentAgent { run() {} }'; // Valid
    });

    await auditAgentModule(mockCommand, 'test-api', {});
    expect(mockCommand.success).toHaveBeenCalledWith(expect.stringContaining('All 1 agents valid'));
  });

  it('should handle parse errors in agents.yaml', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test-api', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: :');

    await auditAgentModule(mockCommand, 'test-api', {});
    expect(mockCommand.error).toHaveBeenCalledWith(expect.stringContaining('Parse error'));
  });
});
