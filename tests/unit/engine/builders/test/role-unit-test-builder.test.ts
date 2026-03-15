/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { RoleUnitTestBuilder } from '@nexical/generator/engine/builders/test/role-unit-test-builder.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';

vi.mock('@nexical/generator/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn((name, data) => `// Mock content for ${name}`),
  },
}));

describe('RoleUnitTestBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('role.test.ts', '');
    vi.clearAllMocks();
  });

  it('should generate correct schema using role template', () => {
    const builder = new RoleUnitTestBuilder('AdminRole', 'admin', '../roles/admin', ['USER']);
    builder.ensure(sourceFile);

    expect(TemplateLoader.load).toHaveBeenCalledWith(
      'test/unit/role.tsf',
      expect.objectContaining({
        className: 'AdminRole',
        roleName: 'admin',
        rolePath: '../roles/admin',
        compatibleRoles: '["USER"]',
      }),
    );
    expect(sourceFile.getFullText()).toContain('// Mock content for test/unit/role.tsf');
  });
});
