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
});
