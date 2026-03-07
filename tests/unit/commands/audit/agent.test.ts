import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuditAgentCommand from '@nexical/generator/commands/audit/agent.js';
import { ModuleLocator } from '@nexical/generator/lib/module-locator.js';
import fs from 'node:fs';
import YAML from 'yaml';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

vi.mock('@nexical/generator/lib/module-locator.js', () => ({
  ModuleLocator: {
    expand: vi.fn(),
  },
}));

describe('AuditAgentCommand', () => {
  let command: AuditAgentCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    command = new AuditAgentCommand();
    vi.spyOn(command, 'info').mockImplementation(() => {});
    vi.spyOn(command, 'success').mockImplementation(() => {});
    vi.spyOn(command, 'warn').mockImplementation(() => {});
    vi.spyOn(command, 'error').mockImplementation(() => {});
  });

  it('should warn if no modules are found', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    await command.run({ name: 'test' });
    expect(command.warn).toHaveBeenCalledWith(expect.stringContaining('No modules found'));
  });

  it('should audit agents.yaml if it exists', async () => {
    const mockModule = { name: 'test-api', path: '/test', app: 'backend' as const };
    vi.mocked(ModuleLocator.expand).mockResolvedValue([mockModule]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      YAML.stringify({
        agents: [{ name: 'TestAgent', type: 'job' }],
      }),
    );

    await command.run({ name: 'test', schema: true });

    expect(command.success).toHaveBeenCalledWith(expect.stringContaining('Schema valid'));
  });

  it('should report schema errors', async () => {
    const mockModule = { name: 'test-api', path: '/test', app: 'backend' as const };
    vi.mocked(ModuleLocator.expand).mockResolvedValue([mockModule]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(YAML.stringify({ agents: [{ name: 'TestAgent' }] })); // Missing 'type'

    await command.run({ name: 'test' });

    expect(command.info).toHaveBeenCalledWith(expect.stringContaining('Schema validation issues'));
    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('Audit failed'));
  });
});
