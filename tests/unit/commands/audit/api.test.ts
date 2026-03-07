import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuditApiCommand from '@nexical/generator/commands/audit/api.js';
import { auditApiModule } from '@nexical/generator/lib/audit-api.js';

vi.mock('@nexical/generator/lib/audit-api.js', () => ({
  auditApiModule: vi.fn(),
}));

describe('AuditApiCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call auditApiModule with the provided name and options', async () => {
    const command = new AuditApiCommand();
    await command.run({ name: 'test-api', schema: true });

    expect(auditApiModule).toHaveBeenCalledWith(command, 'test-api', { schema: true });
  });

  it('should have correct metadata', () => {
    expect(AuditApiCommand.usage).toBe('audit api');
    expect(AuditApiCommand.description).toBe('Audit web-api module code against models.yaml');
    expect(AuditApiCommand.args).toBeDefined();
  });
});
