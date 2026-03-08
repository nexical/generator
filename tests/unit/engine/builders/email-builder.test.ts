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

  it('should skip if no templates are found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const builder = new EmailBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should handle invalid YAML in emails.yaml', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: :');
    const builder = new EmailBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should handle templates without props', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('templates: [{ id: "test", name: "TestEmail" }]');
    const builder = new EmailBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    const testFile = project.getSourceFile('src/emails/TestEmail.tsx');
    expect(testFile).toBeDefined();
    expect(testFile?.getFullText()).toContain('interface TestEmailProps');
    expect(testFile?.getFullText()).toMatch(/const\s*\{\s*\}\s*=\s*props;/);
  });

  it('should throw error on getSchema', () => {
    const builder = new EmailBuilder('test-ui', { name: 'test-ui' });
    expect(() => (builder as unknown as { getSchema: () => void }).getSchema()).toThrow(
      'EmailBuilder manages multiple files',
    );
  });
});
