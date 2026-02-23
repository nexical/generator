import { Project, SourceFile } from 'ts-morph';
import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionPrimitive } from '@nexical/generator/engine/primitives/nodes/permission.js';

describe('PermissionPrimitive', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
  });

  it('should ensure permission registry and class', () => {
    const primitive = new PermissionPrimitive(
      { 'read:users': { description: 'Read users' } },
      { admin: ['read:users'] },
    );

    primitive.ensure(sourceFile);

    expect(sourceFile.getVariableDeclaration('PermissionRegistry')).toBeDefined();
    expect(sourceFile.getTypeAlias('PermissionAction')).toBeDefined();
    expect(sourceFile.getVariableDeclaration('RolePermissions')).toBeDefined();

    const classNode = sourceFile.getClass('Permission');
    expect(classNode).toBeDefined();
    const checkMethod = classNode!.getStaticMethod('check');
    expect(checkMethod).toBeDefined();
    expect(checkMethod!.getReturnType().getText()).toBe('boolean');
  });

  it('should handle missing rolePermissions', () => {
    const primitive = new PermissionPrimitive({ 'read:users': { description: 'Read users' } });

    primitive.ensure(sourceFile);
    expect(sourceFile.getVariableDeclaration('RolePermissions')).toBeUndefined();

    const checkMethod = sourceFile.getClass('Permission')!.getStaticMethod('check');
    expect(checkMethod!.getStatements()[0].getText()).toBe('return false;');
  });

  it('should find PermissionRegistry', () => {
    sourceFile.addVariableStatement({
      declarationKind: 'const',
      declarations: [{ name: 'PermissionRegistry', initializer: '{}' }],
    });
    const primitive = new PermissionPrimitive({}, {});
    expect(primitive.find(sourceFile)).toBeDefined();
  });

  it('should validate', () => {
    const primitive = new PermissionPrimitive({}, {});
    expect(primitive.validate({})).toEqual({ valid: true, issues: [] });
  });
});
