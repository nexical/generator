/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { MiddlewareUnitTestBuilder } from '@nexical/generator/engine/builders/test/unit/middleware-unit-test-builder.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';

vi.mock('@nexical/generator/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn((name, data) => `// Mock content for ${name}`),
  },
}));

describe('MiddlewareUnitTestBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('middleware.test.ts', '');
    vi.clearAllMocks();
  });

  it('should generate correct schema using middleware template', () => {
    const builder = new MiddlewareUnitTestBuilder('test-api', '../middleware/auth');
    builder.ensure(sourceFile);

    expect(TemplateLoader.load).toHaveBeenCalledWith(
      'test/unit/middleware.tsf',
      expect.objectContaining({
        moduleName: 'test-api',
        middlewarePath: '../middleware/auth',
      }),
    );
    expect(sourceFile.getFullText()).toContain('// Mock content for test/unit/middleware.tsf');
  });
});
