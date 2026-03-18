/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { HookUnitTestBuilder } from '@nexical/generator/engine/builders/test/unit/hook-unit-test-builder.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';

vi.mock('@nexical/generator/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn((name, data) => `// Mock content for ${name}`),
  },
}));

describe('HookUnitTestBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('hook.test.ts', '');
    vi.clearAllMocks();
  });

  it('should generate correct schema using hook template', () => {
    const builder = new HookUnitTestBuilder('MyHook', '../hooks/my-hook');
    builder.ensure(sourceFile);

    expect(TemplateLoader.load).toHaveBeenCalledWith(
      'test/unit/hook.tsf',
      expect.objectContaining({
        hookName: 'MyHook',
        hookPath: '../hooks/my-hook',
      }),
    );
    expect(sourceFile.getFullText()).toContain('// Mock content for test/unit/hook.tsf');
  });
});
