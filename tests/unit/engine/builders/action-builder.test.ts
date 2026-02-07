/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { ActionBuilder } from '../../../../src/engine/builders/action-builder.js';

describe('ActionBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
  });

  it('should generate a new action class with default fragment', () => {
    const builder = new ActionBuilder('CreateUser', 'CreateUserInput', 'User');
    builder.ensure(sourceFile);

    const cls = sourceFile.getClass('CreateUser');
    expect(cls).toBeDefined();
    expect(cls?.isExported()).toBe(true);

    const runMethod = cls?.getStaticMethod('run');
    expect(runMethod).toBeDefined();
    expect(runMethod?.isAsync()).toBe(true);
    expect(runMethod?.getReturnType().getText()).toBe('Promise<ServiceResponse<User>>');
    expect(runMethod?.getParameters()[0].getType().getText()).toBe('CreateUserInput');

    // Verify Fragment Content (Interpolated)
    expect(runMethod?.getBodyText()).toContain(
      'return { success: true, data: {} as unknown as User };',
    );
  });

  it('should preserve existing functionality', () => {
    sourceFile = project.createSourceFile(
      'existing.ts',
      `
            export class UpdateUser {
                static async run(input: any, context: any) {
                    console.log("Custom Logic");
                    return { success: true };
                }
            }
        `,
    );

    const builder = new ActionBuilder('UpdateUser', 'UpdateUserInput', 'User');
    builder.ensure(sourceFile);

    const cls = sourceFile.getClass('UpdateUser');
    const method = cls?.getStaticMethod('run');
    expect(method?.getBodyText()).toContain('console.log("Custom Logic")');
  });

  it('should add imports correctly', () => {
    const builder = new ActionBuilder('DeleteUser', 'DeleteUserInput', 'void');
    builder.ensure(sourceFile);

    const imports = sourceFile.getImportDeclarations();
    expect(imports.some((i) => i.getModuleSpecifierValue() === '@/types/service')).toBe(true);
    expect(imports.some((i) => i.getModuleSpecifierValue() === 'astro')).toBe(true);
  });
});
