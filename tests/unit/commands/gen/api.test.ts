import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GenApiCommand from '@nexical/generator/commands/gen/api.js';
import { generateApiModule } from '@nexical/generator/lib/generate-api.js';

vi.mock('@nexical/generator/lib/generate-api.js');

describe('GenApiCommand', () => {
  let command: GenApiCommand;

  beforeEach(() => {
    command = new GenApiCommand();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call generateApiModule with the correct module name', async () => {
    await command.run({ name: 'test-api' });
    expect(generateApiModule).toHaveBeenCalledWith(command, 'test-api');
  });

  it('should call generateApiModule with undefined when name is missing', async () => {
    await command.run({});
    expect(generateApiModule).toHaveBeenCalledWith(command, undefined);
  });
});
