import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuditUiCommand from '@nexical/generator/commands/audit/ui.js';
import { auditUiModule } from '@nexical/generator/lib/audit-ui.js';

vi.mock('@nexical/generator/lib/audit-ui.js', () => ({
  auditUiModule: vi.fn(),
}));

describe('AuditUiCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call auditUiModule with the provided name and options', async () => {
    const command = new AuditUiCommand();
    await command.run({ name: 'test-ui', schema: true });

    expect(auditUiModule).toHaveBeenCalledWith(command, 'test-ui', { schema: true });
  });

  it('should have correct metadata', () => {
    expect(AuditUiCommand.usage).toBe('audit ui');
    expect(AuditUiCommand.description).toBe('Audit UI module configuration and generated files');
    expect(AuditUiCommand.args).toBeDefined();
  });
});
