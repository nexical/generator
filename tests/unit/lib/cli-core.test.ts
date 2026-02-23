import { describe, it, expect } from 'vitest';
import * as cliCore from '@nexical/generator/lib/cli-core.js';

describe('cli-core', () => {
  it('should export BaseCommand and other core items', () => {
    expect(cliCore.BaseCommand).toBeDefined();
    expect(cliCore.CustomHelp).toBeDefined();
    expect(cliCore.logger).toBeDefined();
  });
});
