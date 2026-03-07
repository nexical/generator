import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenApiCommand from '@nexical/generator/commands/gen/api.js';
import { generateApiModule } from '@nexical/generator/lib/generate-api.js';

vi.mock('@nexical/generator/lib/generate-api.js', () => ({
  generateApiModule: vi.fn(),
}));

describe('GenApiCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call generateApiModule with the provided name', async () => {
    const command = new GenApiCommand();
    await command.run({ name: 'test-api' });

    expect(generateApiModule).toHaveBeenCalledWith(command, 'test-api');
  });

  it('should have correct metadata', () => {
    expect(GenApiCommand.usage).toBe('gen api');
    expect(GenApiCommand.description).toBe('Generate web-api module code from models.yaml');
    expect(GenApiCommand.args).toBeDefined();
  });
});
