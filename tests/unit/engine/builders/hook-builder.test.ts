/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { HookBuilder } from '@nexical/generator/engine/builders/hook-builder.js';
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
      const pathStr = String(path);
      if (pathStr.endsWith('hooks.yaml')) {
        return `
hooks:
  - event: "user.created"
    action: "SendWelcomeEmail"
  - event: "order.paid"
    action: "MarkAsShipped"
`;
      }
      if (pathStr.endsWith('.tsf')) {
        return 'export default fragment`HookSystem.${method}("${event}", ${action});`';
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

  it('should handle filters and existing imports', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const pathStr = String(path);
      if (pathStr.endsWith('hooks.yaml')) {
        return `
hooks:
  - event: "data.process"
    action: "Transform"
    filter: true
`;
      }
      if (pathStr.endsWith('.tsf')) {
        return 'export default fragment`HookSystem.${method}("${event}", ${action});`';
      }
      return '';
    });

    const builder = new HookBuilder('test-api', { name: 'test-api' });
    // Setup a file with existing imports to cover the filter branch
    const fileName = 'src/hooks/data-process-Transform.ts';
    project.createSourceFile(
      fileName,
      "import { something } from './else';\nconsole.log(something);",
      { overwrite: true },
    );

    await builder.build(project, undefined);

    const file = project.getSourceFile(fileName);
    const text = file?.getFullText();
    expect(text).toContain('HookSystem.filter("data.process"');
    expect(text).toContain("import { something } from './else'");
  });

  it('should handle parsing errors in hooks.yaml', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: :');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const builder = new HookBuilder('test-api', { name: 'test-api' });
    await builder.build(project, undefined);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse hooks.yaml'));
    warnSpy.mockRestore();
  });

  it('should throw error in getSchema', () => {
    const builder = new HookBuilder('test-api', { name: 'test-api' });
    // @ts-expect-error - testing private/protected method
    expect(() => builder.getSchema()).toThrow('HookBuilder manages multiple files. Use build().');
  });

  it('should skip if hooks.yaml is empty or whitespace', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('   ');
    const builder = new HookBuilder('test-api', { name: 'test-api' });
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });
});
