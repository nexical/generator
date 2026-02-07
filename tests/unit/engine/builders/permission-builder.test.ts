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
    expect(checkMethod?.getBodyText()).toContain('throw new Error');
  });
});
