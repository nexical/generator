import { Project, SourceFile } from 'ts-morph';
import { describe, it, expect, beforeEach } from 'vitest';
import { RolePrimitive } from '@nexical/generator/engine/primitives/nodes/role.js';

describe('RolePrimitive', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
  });

  it('should ensure role class and properties', () => {
    const primitive = new RolePrimitive({
      name: 'ADMIN',
      definition: {
        description: 'Administrator role',
        inherits: ['USER'],
        permissions: ['read:all', 'write:all'],
      },
    });

    primitive.ensure(sourceFile);

    const classNode = sourceFile.getClass('AdminRole');
    expect(classNode).toBeDefined();
    expect(classNode!.getExtends()?.getText()).toBe('BaseRole');
    expect(classNode!.getJsDocs()[0].getDescription().trim()).toBe('Administrator role');

    const nameProp = classNode!.getProperty('name');
    expect(nameProp!.getInitializer()!.getText()).toBe("'ADMIN'");

    const inheritsProp = classNode!.getProperty('inherits');
    expect(inheritsProp!.getInitializer()!.getText()).toBe("['USER']");

    const permissionsProp = classNode!.getProperty('permissions');
    expect(permissionsProp!.getInitializer()!.getText()).toBe("['read:all', 'write:all']");
  });

  it('should find existing role class', () => {
    sourceFile.addClass({ name: 'UserRole' });
    const primitive = new RolePrimitive({
      name: 'USER',
      definition: { description: '' },
    });

    const found = primitive.find(sourceFile);
    expect(found).toBeDefined();
    expect(found!.getName()).toBe('UserRole');
  });

  it('should validate (always returns true for now)', () => {
    const primitive = new RolePrimitive({
      name: 'TEST',
      definition: { description: '' },
    });
    expect(primitive.validate({})).toEqual({ valid: true, issues: [] });
  });
});
