/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { ConfigUnitTestBuilder } from '@nexical/generator/engine/builders/test/config-unit-test-builder.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';

vi.mock('@nexical/generator/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn((name, data) => `// Mock content for ${name}`),
  },
}));

describe('ConfigUnitTestBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('config.test.ts', '');
    vi.clearAllMocks();
  });

  it('should generate correct schema using config template', () => {
    const builder = new ConfigUnitTestBuilder('AppSettings', '../config/app-settings');
    builder.ensure(sourceFile);

    expect(TemplateLoader.load).toHaveBeenCalledWith(
      'test/unit/config.tsf',
      expect.objectContaining({
        configName: 'AppSettings',
        configPath: '../config/app-settings',
      }),
    );
    expect(sourceFile.getFullText()).toContain('// Mock content for test/unit/config.tsf');
  });
});
