/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { EmailBuilder } from '../../../../src/engine/builders/email-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('EmailBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should generate email templates and init file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('emails.yaml')) {
        return `
templates:
  - id: "user:welcome"
    name: "WelcomeEmail"
    props:
      - name: name
        type: string
`;
      }
      return '';
    });

    const builder = new EmailBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    const welcomeFile = project.getSourceFile('src/emails/WelcomeEmail.tsx');
    expect(welcomeFile).toBeDefined();
    const welcomeText = welcomeFile?.getFullText();
    expect(welcomeText).toContain('export function WelcomeEmail');
    expect(welcomeText).toContain('interface WelcomeEmailProps');
    expect(welcomeText).toContain('name: string');

    const initFile = project.getSourceFile('src/emails/init.ts');
    expect(initFile).toBeDefined();
    const initText = initFile?.getFullText();
    expect(initText).toContain('import { EmailRegistry } from "@/lib/email/email-registry"');
    expect(initText).toContain("EmailRegistry.register('user:welcome', WelcomeEmail)");
  });
});
