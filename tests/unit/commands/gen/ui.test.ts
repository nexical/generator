import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenUiCommand from '@nexical/generator/commands/gen/ui.js';
import { generateUiModule } from '@nexical/generator/lib/generate-ui.js';

vi.mock('@nexical/generator/lib/generate-ui.js', () => ({
  generateUiModule: vi.fn(),
}));

describe('GenUiCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call generateUiModule with the provided name', async () => {
    const command = new GenUiCommand();
    await command.run({ name: 'test-ui' });

    expect(generateUiModule).toHaveBeenCalledWith(command, 'test-ui');
  });

  it('should have correct metadata', () => {
    expect(GenUiCommand.usage).toBe('gen ui');
    expect(GenUiCommand.description).toBe('Generate UI module code from ui.yaml');
    expect(GenUiCommand.args).toBeDefined();
  });
});
