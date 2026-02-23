import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AuditApiCommand from '@nexical/generator/commands/audit/api.js';
import { auditApiModule } from '@nexical/generator/lib/audit-api.js';

vi.mock('@nexical/generator/lib/audit-api.js');

describe('AuditApiCommand', () => {
  let command: AuditApiCommand;

  beforeEach(() => {
    command = new AuditApiCommand();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call auditApiModule with the correct arguments', async () => {
    await command.run({ name: 'test-api' });

    expect(auditApiModule).toHaveBeenCalledWith(command, 'test-api', { schema: undefined });
  });

  it('should pass schema option', async () => {
    await command.run({ name: 'test-api', schema: true });

    expect(auditApiModule).toHaveBeenCalledWith(command, 'test-api', { schema: true });
  });
});
