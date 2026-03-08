/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { PermissionBuilder } from '../../../../src/engine/builders/permission-builder';

describe('PermissionBuilder', () => {
  it('should generate permission class', () => {
    const builder = new PermissionBuilder('DeleteUser');
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const cls = sourceFile.getClass('DeleteUserPermission');
    expect(cls).toBeDefined();
    const checkMethod = cls?.getStaticMethod('check');
    expect(checkMethod).toBeDefined();
    expect(checkMethod?.getBodyText()).toContain('if (!context.locals?.actor && !context.user)');
  });

  it('should merge named imports if module already exists', () => {
    const builder = new PermissionBuilder('UpdateUser');
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      "import { Other } from 'astro';\nimport { Custom } from './local';",
    );

    builder.ensure(sourceFile);

    const impAstro = sourceFile.getImportDeclaration('astro');
    expect(impAstro?.getNamedImports().map((i) => i.getName())).toContain('APIContext');
    expect(impAstro?.getNamedImports().map((i) => i.getName())).toContain('Other');

    const impLocal = sourceFile.getImportDeclaration('./local');
    expect(impLocal).toBeDefined();
    expect(impLocal?.getNamedImports().map((i) => i.getName())).toContain('Custom');
  });

  it('should handle existing imports without named imports (coverage)', () => {
    const builder = new PermissionBuilder('Test');
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', "import './side-effect';");

    builder.ensure(sourceFile);
    expect(sourceFile.getImportDeclaration('./side-effect')).toBeDefined();
  });
});
