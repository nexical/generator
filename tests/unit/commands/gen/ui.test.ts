import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GenUiCommand from '@nexical/generator/commands/gen/ui.js';
import { generateUiModule } from '@nexical/generator/lib/generate-ui.js';

vi.mock('@nexical/generator/lib/generate-ui.js');

describe('GenUiCommand', () => {
  let command: GenUiCommand;

  beforeEach(() => {
    command = new GenUiCommand();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call generateUiModule with the correct module name', async () => {
    await command.run({ name: 'test-ui' });
    expect(generateUiModule).toHaveBeenCalledWith(command, 'test-ui');
  });

  it('should call generateUiModule with undefined when name is missing', async () => {
    await command.run({});
    expect(generateUiModule).toHaveBeenCalledWith(command, undefined);
  });
});
