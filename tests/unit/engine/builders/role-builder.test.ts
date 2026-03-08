/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { RoleBuilder } from '../../../../src/engine/builders/role-builder.js';

describe('RoleBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
  });

  it('should generate a new role class', () => {
    const builder = new RoleBuilder({
      name: 'ADMIN',
      definition: {
        description: 'System Administrator',
        permissions: ['user.create', 'user.delete'],
        inherits: ['MEMBER'],
      },
    });
    builder.ensure(sourceFile);

    const cls = sourceFile.getClass('AdminRole');
    expect(cls).toBeDefined();
    expect(cls?.isExported()).toBe(true);
    expect(cls?.getExtends()?.getText()).toBe('BaseRole');

    const nameProp = cls?.getProperty('name');
    expect(nameProp?.getInitializer()?.getText()).toBe("'ADMIN'");

    const descProp = cls?.getProperty('description');
    expect(descProp?.getInitializer()?.getText()).toBe("'System Administrator'");

    const permsProp = cls?.getProperty('permissions');
    expect(permsProp?.getInitializer()?.getText()).toBe("['user.create', 'user.delete']");
  });

  it('should preserve custom manual imports', () => {
    sourceFile = project.createSourceFile(
      'custom-role.ts',
      `
        import { someUtil } from '@/utils';
        // GENERATED CODE - THE SIGNATURE IS MANAGED BY THE GENERATOR. YOU MAY MODIFY THE IMPLEMENTATION AND ADD CUSTOM IMPORTS.
        export class AdminRole extends BaseRole {
            readonly name = 'ADMIN';
        }
    `,
    );

    const builder = new RoleBuilder({
      name: 'ADMIN',
      definition: {
        description: 'Admin',
      },
    });
    builder.ensure(sourceFile);

    const imports = sourceFile.getImportDeclarations().map((i) => i.getModuleSpecifierValue());
    expect(imports).toContain('@/utils');
    expect(imports).toContain('./base-role');
  });

  it('should handle side-effect imports correctly during merge', () => {
    sourceFile = project.createSourceFile('side-effect-role.ts', "import './base-role';");
    const builder = new RoleBuilder({
      name: 'SIDE',
      definition: {},
    });
    builder.ensure(sourceFile);

    const baseRoleImport = sourceFile.getImportDeclaration('./base-role');
    // It should have both side-effect and named import 'BaseRole' now (merged)
    expect(baseRoleImport?.getNamedImports().map((n) => n.getName())).toContain('BaseRole');
  });

  it('should handle optional fields and merge imports', () => {
    sourceFile = project.createSourceFile(
      'merge-role.ts',
      "import { BaseRole } from './base-role';\nimport { other } from './base-role';",
    );
    const builder = new RoleBuilder({
      name: 'USER',
      definition: {}, // Empty definition
      compatibleRoles: ['GUEST'],
    });
    builder.ensure(sourceFile);

    const cls = sourceFile.getClass('UserRole');
    expect(cls?.getProperty('description')?.getInitializer()?.getText()).toBe("''");
    expect(cls?.getProperty('inherits')?.getInitializer()?.getText()).toBe('[]');
    expect(cls?.getProperty('permissions')?.getInitializer()?.getText()).toBe('[]');
    expect(cls?.getProperty('compatibleRoles')?.getInitializer()?.getText()).toBe("['GUEST']");

    const baseRoleImport = sourceFile.getImportDeclaration('./base-role');
    expect(baseRoleImport?.getNamedImports().map((n) => n.getName())).toContain('BaseRole');
  });

  it('should cover getNodes callback in statements', () => {
    const builder = new RoleBuilder({
      name: 'USER',
      definition: {},
    });
    // @ts-expect-error - access private method for coverage
    const schema = builder.getSchema();
    const statement = schema.statements?.[0];
    if (typeof statement === 'object' && 'getNodes' in statement) {
      expect(statement.getNodes(project)).toEqual([]);
    }
  });
});
