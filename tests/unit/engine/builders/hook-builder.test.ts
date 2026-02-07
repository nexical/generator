/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { HookBuilder } from '../../../../src/engine/builders/hook-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('HookBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should generate hook files from config', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('hooks.yaml')) {
        return `
hooks:
  - event: "user.created"
    action: "SendWelcomeEmail"
  - event: "order.paid"
    action: "MarkAsShipped"
`;
      }
      return '';
    });

    const builder = new HookBuilder('test-api', { name: 'test-api' });
    await builder.build(project, undefined);

    const onFile = project.getSourceFile('src/hooks/user-created-SendWelcomeEmail.ts');
    expect(onFile).toBeDefined();
    const onText = onFile?.getFullText();
    expect(onText).toContain('HookSystem.on("user.created"');
    expect(onText).toContain('SendWelcomeEmail');

    const filterFile = project.getSourceFile('src/hooks/order-paid-MarkAsShipped.ts');
    expect(filterFile).toBeDefined();
    expect(filterFile?.getFullText()).toContain('HookSystem.on("order.paid"');
  });
});
