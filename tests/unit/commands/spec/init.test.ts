import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { SpecInitCommand } from '../../../../src/commands/spec/init.js';
import { AgentRunner } from '../../../../src/utils/agent-runner.js';
import { ModuleLocator } from '../../../../src/lib/module-locator.js';

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    writeFile: vi.fn(),
    ensureDir: vi.fn(),
  },
}));

vi.mock('../../../../src/utils/agent-runner.js', () => ({
  AgentRunner: {
    run: vi.fn(),
  },
}));

vi.mock('../../../../src/lib/module-locator.js', () => ({
  ModuleLocator: {
    resolve: vi.fn(),
  },
}));

describe('SpecInitCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(
      (code?: number | string | null) => undefined as never,
    );
  });

  it('should pass aiConfig from cli config to AgentRunner', async () => {
    const config = {
      generator: {
        ai: {
          provider: 'custom-provider',
          commandTemplate: 'custom-template',
        },
      },
    };

    vi.mocked(ModuleLocator.resolve).mockReturnValue({
      name: 'test-module',
      path: '/mock/path/test-module',
      app: 'backend',
    });
    vi.mocked(fs.pathExists).mockResolvedValue(false as never);

    const command = new SpecInitCommand([], {} as never);
    (command as unknown as { config: unknown }).config = config;

    // We stub success and info to avoid console spam
    command.success = vi.fn();
    command.info = vi.fn();
    command.warn = vi.fn();

    await command.run({ name: 'test-module' });

    expect(AgentRunner.run).toHaveBeenCalledWith(
      'SpecWriter',
      'agents/module-spec-writer.md',
      expect.objectContaining({
        aiConfig: config.generator.ai,
      }),
      true,
    );
  });
});
