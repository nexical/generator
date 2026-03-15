/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { PermissionUnitTestBuilder } from '@nexical/generator/engine/builders/test/permission-unit-test-builder.js';

vi.mock('@nexical/generator/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn((name, data) => `// Mock content for ${name}`),
  },
}));

describe('PermissionUnitTestBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('permission.test.ts', '');
    vi.clearAllMocks();
  });

  it('should generate correct schema with static permission tests', () => {
    const builder = new PermissionUnitTestBuilder('test-api');
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain("describe('Permission', () => {");
    expect(text).toContain('expect(Permission).toBeDefined();');
    expect(text).toContain("expect(typeof Permission.check).toBe('function');");
  });
});
