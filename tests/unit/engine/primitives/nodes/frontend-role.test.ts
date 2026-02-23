import { Project, SourceFile } from 'ts-morph';
import { describe, it, expect, beforeEach } from 'vitest';
import { FrontendRolePrimitive } from '@nexical/generator/engine/primitives/nodes/frontend-role.js';

describe('FrontendRolePrimitive', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
  });

  it('should ensure frontend role class', () => {
    const primitive = new FrontendRolePrimitive({
      name: 'USER',
      definition: {
        description: 'User role',
      },
    });

    primitive.ensure(sourceFile);

    const classNode = sourceFile.getClass('UserRole');
    expect(classNode).toBeDefined();
    expect(classNode!.getExtends()?.getText()).toBe('BaseRole');

    const nameProp = classNode!.getProperty('name');
    expect(nameProp!.getInitializer()!.getText()).toBe("'USER'");
  });

  it('should find existing frontend role class', () => {
    sourceFile.addClass({ name: 'AdminRole' });
    const primitive = new FrontendRolePrimitive({
      name: 'ADMIN',
      definition: { description: '' },
    });

    const found = primitive.find(sourceFile);
    expect(found).toBeDefined();
    expect(found!.getName()).toBe('AdminRole');
  });

  it('should validate', () => {
    const primitive = new FrontendRolePrimitive({
      name: 'TEST',
      definition: { description: '' },
    });
    expect(primitive.validate({})).toEqual({ valid: true, issues: [] });
  });
});
