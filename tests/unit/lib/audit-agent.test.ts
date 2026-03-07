import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditAgentModule } from '../../../src/lib/audit-agent.js';
import { ModuleLocator } from '../../../src/lib/module-locator.js';
import fs from 'node:fs';
import YAML from 'yaml';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

vi.mock('../../../src/lib/module-locator.js', () => ({
  ModuleLocator: {
    expand: vi.fn(),
  },
}));

describe('auditAgentModule Unit', () => {
  let command: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    command = {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Record<string, unknown>;
  });

  it('should pass for valid agents.yaml', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).endsWith('agents.yaml')) {
        return YAML.stringify({ agents: [{ name: 'TestAgent', type: 'job' }] });
      }
      return 'class TestAgent extends JobProcessor { process() {} }';
    });

    await auditAgentModule(command as any, 'test-api', {});

    expect(command.success).toHaveBeenCalledWith(expect.stringContaining('Audit passed'));
  });

  it('should report missing agents.yaml', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await auditAgentModule(command as any, 'test-api', {});

    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('Audit failed'));
  });

  it('should report schema validation issues', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      YAML.stringify({
        agents: [{ name: 'TestAgent' }], // Missing type
      }),
    );

    await auditAgentModule(command as any, 'test-api', {});

    expect(command.info).toHaveBeenCalledWith(expect.stringContaining('Schema validation issues'));
  });

  it('should report missing agent file', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('agents.yaml')); // Only yaml exists
    vi.mocked(fs.readFileSync).mockReturnValue(
      YAML.stringify({
        agents: [{ name: 'TestAgent', type: 'job' }],
      }),
    );

    await auditAgentModule(command as any, 'test-api', {});

    expect(command.warn).toHaveBeenCalledWith(expect.stringContaining('Missing: src/agent'));
  });

  it('should report invalid persistent agent implementation', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).endsWith('agents.yaml')) {
        return YAML.stringify({ agents: [{ name: 'PersAgent', type: 'persistent' }] });
      }
      return 'invalid content';
    });

    await auditAgentModule(command as any, 'test-api', {});

    expect(command.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid PersistentAgent implementation'),
    );
  });

  it('should handle parse errors', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: :');

    await auditAgentModule(command as any, 'test-api', {});

    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('Parse error'));
  });

  it('should support object format in agents.yaml', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).endsWith('agents.yaml')) {
        return YAML.stringify({ MyObjAgent: { type: 'job' } });
      }
      return 'class MyObjAgent extends JobProcessor { process() {} }';
    });

    await auditAgentModule(command as any, 'test-api', { schema: true });

    expect(command.success).toHaveBeenCalledWith(
      expect.stringContaining('Schema valid (1 agents)'),
    );
  });

  it('should report invalid job agent implementation', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'test-api', path: '/test', app: 'backend' },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p).endsWith('agents.yaml')) {
        return YAML.stringify({ agents: [{ name: 'JobAgent', type: 'job' }] });
      }
      return 'invalid content';
    });

    await auditAgentModule(command as any, 'test-api', {});

    expect(command.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid JobProcessor implementation'),
    );
  });
});
