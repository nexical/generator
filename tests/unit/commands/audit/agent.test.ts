import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { ModuleLocator } from '@nexical/generator/lib/module-locator.js';
import AuditAgentCommand from '@nexical/generator/commands/audit/agent.js';

vi.mock('fs');
vi.mock('@nexical/generator/lib/module-locator.js');

describe('AuditAgentCommand', () => {
  let command: AuditAgentCommand;

  beforeEach(() => {
    command = new AuditAgentCommand();
    vi.spyOn(command, 'info').mockImplementation(() => {});
    vi.spyOn(command, 'warn').mockImplementation(() => {});
    vi.spyOn(command, 'error').mockImplementation(() => {});
    vi.spyOn(command, 'success').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle no modules found', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    await command.run({ name: 'test-pattern' });
    expect(command.warn).toHaveBeenCalledWith('No modules found matching pattern "test-pattern"');
  });

  it('should handle missing agents.yaml (verbose)', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-module', path: '/test' }]);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await command.run({ verbose: true });

    expect(command.info).toHaveBeenCalledWith('  test-module: No agents.yaml found');
  });

  it('should handle missing agents.yaml (non-verbose)', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-module', path: '/test' }]);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await command.run({ verbose: false });

    expect(command.info).not.toHaveBeenCalledWith('  test-module: No agents.yaml found');
  });

  it('should handle yaml parse error', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-module', path: '/test' }]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('YAMLError');
    });

    await command.run({});

    expect(command.error).toHaveBeenCalledWith('test-module: Parse error');
  });

  it('should handle yaml parse error (string error)', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-module', path: '/test' }]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw 'StringError';
    });

    await command.run({});

    expect(command.error).toHaveBeenCalledWith('test-module: Parse error');
  });

  it('should handle schema validation failure', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-module', path: '/test' }]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml');

    await command.run({});

    expect(command.error).toHaveBeenCalledWith('test-module: Schema validation failed');
  });

  it('should pass schema validation and return early with --schema flag', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-module', path: '/test' }]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      'agents:\n  - name: test1\n    type: job\n    jobType: test',
    );

    await command.run({ schema: true });

    expect(command.success).toHaveBeenCalledWith('test-module: Schema valid (1 agents)');
  });

  it('should handle missing agent files', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-module', path: '/test' }]);

    vi.mocked(fs.existsSync).mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath.endsWith('agents.yaml')) return true;
      return false; // agent file does not exist
    });
    vi.mocked(fs.readFileSync).mockReturnValue(
      'agents:\n  - name: test1\n    type: job\n    jobType: test',
    );

    await command.run({});

    expect(command.warn).toHaveBeenCalledWith('test-module: 1 warning(s)');
    expect(command.warn).toHaveBeenCalledWith(
      `  ⚠ Missing: src/agent/test1.ts (run 'arc gen api test-module')`,
    );
  });

  it('should detect missing job processor requirements', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-module', path: '/test' }]);

    vi.mocked(fs.existsSync).mockReturnValue(true);

    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath.endsWith('agents.yaml')) {
        return 'agents:\n  - name: testJob\n    type: job\n    jobType: myJob';
      }
      return 'class myJob {}'; // missing JobProcessor, jobType, process()
    });

    await command.run({});

    expect(command.error).toHaveBeenCalledWith('test-module: 3 error(s)');
    expect(command.error).toHaveBeenCalledWith('  ✗ testJob: Missing JobProcessor base class');
    expect(command.error).toHaveBeenCalledWith('  ✗ testJob: Missing jobType property');
    expect(command.error).toHaveBeenCalledWith('  ✗ testJob: Missing process() method');
  });

  it('should pass valid job processor requirements', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-module', path: '/test' }]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath.endsWith('agents.yaml')) {
        return 'agents:\n  - name: testJob\n    type: job\n    jobType: myJob';
      }
      return 'class myJob extends JobProcessor { jobType = "myJob"; process() {} }';
    });

    await command.run({});

    expect(command.success).toHaveBeenCalledWith('test-module: All 1 agents valid');
  });

  it('should detect missing persistent agent requirements', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-module', path: '/test' }]);

    vi.mocked(fs.existsSync).mockReturnValue(true);

    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath.endsWith('agents.yaml')) {
        return 'agents:\n  - name: testPersistent\n    type: persistent';
      }
      return 'class testPersistent {}'; // missing PersistentAgent, run()
    });

    await command.run({});

    expect(command.error).toHaveBeenCalledWith('test-module: 2 error(s)');
    expect(command.error).toHaveBeenCalledWith(
      '  ✗ testPersistent: Missing PersistentAgent base class',
    );
    expect(command.error).toHaveBeenCalledWith('  ✗ testPersistent: Missing run() method');
  });

  it('should pass valid persistent agent requirements', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([{ name: 'test-module', path: '/test' }]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath.endsWith('agents.yaml')) {
        return 'agents:\n  - name: testPersistent\n    type: persistent';
      }
      return 'class testPersistent extends PersistentAgent { run() {} }';
    });

    await command.run({});

    expect(command.success).toHaveBeenCalledWith('test-module: All 1 agents valid');
  });
});
