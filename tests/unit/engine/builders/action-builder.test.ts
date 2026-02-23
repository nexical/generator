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

  it('should handle void inputs and auto-inject all requested services', () => {
    sourceFile = project.createSourceFile(
      'test-services.ts',
      `
        export class VoidAction {
            static async run(_input: void, context: APIContext) {
                OrchestrationService.do();
                JobMetricsService.do();
                AgentService.do();
                ApiActor.do();
                z.string();
                db.user.findMany();
            }
        }
    `,
    );

    const builder = new ActionBuilder('VoidAction', 'void', 'string');
    builder.ensure(sourceFile);

    const cls = sourceFile.getClass('VoidAction');
    const runMethod = cls?.getStaticMethod('run');
    expect(runMethod?.getParameters()[0].getName()).toBe('_input');

    const imports = sourceFile.getImportDeclarations().map((i) => i.getModuleSpecifierValue());
    expect(imports).toContain('../services/orchestration-service');
    expect(imports).toContain('../services/job-metrics-service');
    expect(imports).toContain('../services/agent-service');
    expect(imports).toContain('@/lib/api/api-docs');
    expect(imports).toContain('zod');
    expect(imports).toContain('@/lib/core/db');
  });
});
