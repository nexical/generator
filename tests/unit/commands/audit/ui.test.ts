import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AuditUiCommand from '@nexical/generator/commands/audit/ui.js';
import { auditUiModule } from '@nexical/generator/lib/audit-ui.js';

vi.mock('@nexical/generator/lib/audit-ui.js');

describe('AuditUiCommand', () => {
  let command: AuditUiCommand;

  beforeEach(() => {
    command = new AuditUiCommand();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call auditUiModule with the correct arguments', async () => {
    await command.run({ name: 'test-ui' });

    expect(auditUiModule).toHaveBeenCalledWith(command, 'test-ui', { schema: undefined });
  });

  it('should pass schema option', async () => {
    await command.run({ name: 'test-ui', schema: true });

    expect(auditUiModule).toHaveBeenCalledWith(command, 'test-ui', { schema: true });
  });
});
