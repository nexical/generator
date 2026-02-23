import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { SpecUpdateCommand } from '../../../../src/commands/spec/update.js';
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
    expand: vi.fn(),
  },
}));

describe('SpecUpdateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(
      (code?: number | string | null) => undefined as never,
    );
  });

  it('should pass aiConfig from cli core config to AgentRunner', async () => {
    const config = {
      ai: {
        provider: 'fallback-provider',
      },
    };

    // Mock ModuleLocator for returning a valid module path
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      {
        name: 'test-module',
        path: '/mock/path/test-module',
        app: 'backend',
      } as never,
    ]);
    vi.mocked(fs.pathExists).mockResolvedValue(true as never);

    const command = new SpecUpdateCommand([], {} as never);
    (command as unknown as { config: unknown }).config = config;

    command.success = vi.fn();
    command.info = vi.fn();
    command.warn = vi.fn();

    await command.run({ name: 'test-module', interactive: false });

    expect(AgentRunner.run).toHaveBeenCalledWith(
      'SpecWriter',
      'agents/module-spec-writer.md',
      expect.objectContaining({
        aiConfig: config.ai,
      }),
      false,
    );
  });
});
