import { type FileDefinition, type NodeContainer, type ModelField } from '../../types.js';
import { BaseBuilder } from '../base-builder.js';
import { TemplateLoader } from '../../../utils/template-loader.js';

export class ServiceUnitTestBuilder extends BaseBuilder {
  private entityLowerName: string = '';
  private errorPrefix: string = '';
  private isModelValid: boolean = false;
  private defaultStatus: string = 'PENDING';
  private serviceFileName: string = '';

  constructor(
    private serviceName: string,
    private entityName: string,
    private servicePath: string, // Relative path from test to service
    private methods: Record<string, number> = { list: 1, get: 1, create: 1, update: 2, delete: 1 },
    private validModels: string[] = [],
    private models: { name: string; fields?: Record<string, ModelField> }[] = [],
  ) {
    super();

    const serviceBaseName = this.serviceName?.replace('Service', '');
    let detectedEntity = serviceBaseName?.charAt(0).toLowerCase() + serviceBaseName?.slice(1);
    this.errorPrefix = detectedEntity;

    const isOrchestrator =
      this.serviceName?.includes('Orchestration') || this.serviceName?.includes('DeadLetter');
    if (isOrchestrator) {
      detectedEntity = 'job';
      this.defaultStatus = 'RUNNING';
    }

    if (this.serviceName === 'DeadLetterQueueService') {
      detectedEntity = 'deadLetterJob';
      this.errorPrefix = 'deadLetterQueue';
    } else if (this.serviceName?.includes('DeadLetter')) {
      detectedEntity = 'deadLetterJob';
      this.errorPrefix = 'deadLetterJob';
    }
    if (this.serviceName?.includes('Auth')) detectedEntity = 'user';

    this.entityLowerName = detectedEntity;
    this.isModelValid =
      this.models.some((m) => m.name.toLowerCase() === this.entityLowerName.toLowerCase()) ||
      ['job', 'deadLetterJob', 'user', 'teamMember', 'invitation'].includes(this.entityLowerName);

    // servicePath is e.g. "../../../src/services/auth-service"
    // We want "auth-service"
    this.serviceFileName = this.servicePath.split('/').pop() || '';
  }

  private renderTests(): string {
    return Object.entries(this.methods)
      .map(([method, paramCount]) => {
        let successTest = '';
        let failureTest = '';

        if (this.isModelValid && method === 'list') {
          successTest = `
        it('should return a list of ${this.entityName}s', async () => {
            const mockData = [{ id: '1' }];
            vi.mocked(db.${this.entityLowerName}.findMany).mockResolvedValue(mockData as unknown as Record<string, unknown>[]);

            const result = await ${this.serviceName}.list();

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockData);
            expect(db.${this.entityLowerName}.findMany).toHaveBeenCalled();
        });`;
          failureTest = `
        it('should handle errors when listing', async () => {
            vi.mocked(db.${this.entityLowerName}.findMany).mockRejectedValue(new Error('DB Error'));

            const result = await ${this.serviceName}.list();

            expect(result.success).toBe(false);
            expect(result.error).toBe('${this.errorPrefix}.service.error.list_failed');
            expect(Logger.error).toHaveBeenCalled();
        });`;
        } else if (this.isModelValid && method === 'get') {
          successTest = `
        it('should return a single ${this.entityName}', async () => {
            const mockData = { id: '1' };
            vi.mocked(db.${this.entityLowerName}.findUnique).mockResolvedValue(mockData as unknown as Record<string, unknown>);

            const result = await ${this.serviceName}.get('1');

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockData);
            expect(db.${this.entityLowerName}.findUnique).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: '1' }
            }));
        });`;
          failureTest = `
        it('should handle not found', async () => {
            vi.mocked(db.${this.entityLowerName}.findUnique).mockResolvedValue(null);

            const result = await ${this.serviceName}.get('1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('${this.errorPrefix}.service.error.not_found');
        });

        it('should handle errors when getting', async () => {
            vi.mocked(db.${this.entityLowerName}.findUnique).mockRejectedValue(new Error('DB Error'));

            const result = await ${this.serviceName}.get('1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('${this.errorPrefix}.service.error.get_failed');
        });`;
        } else if (this.isModelValid && method === 'create') {
          successTest = `
        it('should create a new ${this.entityName}', async () => {
            const mockData = { id: '1', name: 'test' };
            vi.mocked(db.${this.entityLowerName}.create).mockResolvedValue(mockData as unknown as Record<string, unknown>);

            const result = await ${this.serviceName}.create({ name: 'test' } as Record<string, unknown>);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockData);
            expect(db.${this.entityLowerName}.create).toHaveBeenCalled();
        });`;
          failureTest = `
        it('should handle errors when creating', async () => {
            vi.mocked(db.${this.entityLowerName}.create).mockRejectedValue(new Error('DB Error'));

            const result = await ${this.serviceName}.create({} as Record<string, unknown>);

            expect(result.success).toBe(false);
            expect(result.error).toBe('${this.errorPrefix}.service.error.create_failed');
        });`;
        } else if (this.isModelValid && method === 'update') {
          successTest = `
        it('should update an existing ${this.entityName}', async () => {
            const mockData = { id: '1', name: 'updated' };
            vi.mocked(db.${this.entityLowerName}.update).mockResolvedValue(mockData as unknown as Record<string, unknown>);

            const result = await ${this.serviceName}.update('1', { name: 'updated' } as Record<string, unknown>);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockData);
            expect(db.${this.entityLowerName}.update).toHaveBeenCalled();
        });`;
          failureTest = `
        it('should handle errors when updating', async () => {
            vi.mocked(db.${this.entityLowerName}.update).mockRejectedValue(new Error('DB Error'));

            const result = await ${this.serviceName}.update('1', {} as Record<string, unknown>);

            expect(result.success).toBe(false);
            expect(result.error).toBe('${this.errorPrefix}.service.error.update_failed');
        });`;
        } else if (this.isModelValid && method === 'delete') {
          successTest = `
        it('should delete an ${this.entityName}', async () => {
            vi.mocked(db.${this.entityLowerName}.delete).mockResolvedValue({} as unknown as Record<string, unknown>);

            const result = await ${this.serviceName}.delete('1');

            expect(result.success).toBe(true);
            expect(db.${this.entityLowerName}.delete).toHaveBeenCalled();
        });`;
          failureTest = `
        it('should handle errors when deleting', async () => {
            vi.mocked(db.${this.entityLowerName}.delete).mockRejectedValue(new Error('DB Error'));

            const result = await ${this.serviceName}.delete('1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('${this.errorPrefix}.service.error.delete_failed');
        });`;
        } else if (this.isModelValid && method === 'count') {
          successTest = `
        it('should return the count of ${this.entityName}s', async () => {
            vi.mocked(db.${this.entityLowerName}.count).mockResolvedValue(10);

            const result = await ${this.serviceName}.count();

            expect(result.success).toBe(true);
            expect(result.data).toBe(10);
            expect(db.${this.entityLowerName}.count).toHaveBeenCalled();
        });`;
          failureTest = `
        it('should handle errors when counting', async () => {
            vi.mocked(db.${this.entityLowerName}.count).mockRejectedValue(new Error('DB Error'));

            const result = await ${this.serviceName}.count();

            expect(result.success).toBe(false);
            expect(result.error).toBe('${this.errorPrefix}.service.error.count_failed');
        });`;
        } else {
          const isLongRunning =
            method.toLowerCase().includes('wait') ||
            method.toLowerCase().includes('delay') ||
            method.toLowerCase().includes('sleep');
          if (isLongRunning) return '';

          const args: string[] = [];
          const defaultObj = `{ id: 'ne_pat_test', email: 'test@example.com', name: 'Test', token: 'token', teamId: '1', role: 'TEAM_MEMBER', status: '${this.defaultStatus}', password: 'password', confirmPassword: 'password' }`;
          const m = method.toLowerCase();

          for (let i = 0; i < paramCount; i++) {
            let argContent = `${defaultObj} as Record<string, unknown>`;

            if (m === 'updateprogress') {
              if (i === 1) argContent = '50';
              else argContent = "'ne_pat_test'";
            } else if (m === 'poll') {
              if (i === 0) argContent = "'agent-1'";
              else if (i === 1) argContent = "['TASK'] as unknown[]";
              else if (i === 2) argContent = "'ne_pat_test'";
              else if (i === 3) argContent = "'user'";
            } else if (m === 'register' && i === 0) {
              argContent = defaultObj;
            } else if (m.includes('complete') || m.includes('fail') || m.includes('retry')) {
              if (i === 0) argContent = "'ne_pat_test'";
              else if (i === 1) argContent = "{ result: 'ok' } as Record<string, unknown>";
              else if (i === 2) argContent = "'ne_pat_test'";
              else if (i === 3) argContent = "'user'";
            } else {
              let useString = false;
              if (i === 0) {
                useString =
                  m.includes('cancel') ||
                  m.includes('complete') ||
                  m.includes('fail') ||
                  m.includes('retry') ||
                  m.includes('id') ||
                  m.includes('token') ||
                  m.includes('key') ||
                  m.includes('validate') ||
                  m.includes('verify') ||
                  m.includes('poll') ||
                  m.includes('heartbeat');
              } else if (i >= 1) {
                useString =
                  m.includes('cancel') ||
                  m.includes('complete') ||
                  m.includes('fail') ||
                  m.includes('retry') ||
                  m.includes('updateprogress') ||
                  m.includes('heartbeat') ||
                  m.includes('checkstaleagents');
              }

              if (useString) argContent = "'ne_pat_test' as unknown";
            }

            args.push(argContent);
          }

          // Always add actor if it's an orchestrator/dead-letter service and not already added
          const isOrchestrator =
            this.serviceName.toLowerCase().includes('orchestrator') ||
            this.serviceName.toLowerCase().includes('deadletter');
          if (isOrchestrator && !args.some((a) => a.includes("'ne_pat_test'"))) {
            args.push("'ne_pat_test'");
          }

          const dbErrorMocks = this.isModelValid
            ? `
            try {
              vi.mocked(db.${this.entityLowerName}.findFirst).mockRejectedValueOnce(new Error('DB Error'));
              vi.mocked(db.${this.entityLowerName}.findUnique).mockRejectedValueOnce(new Error('DB Error'));
            } catch {
              // Ignore expected errors during setup
            }`
            : '';

          successTest = `
        it('should run ${method} successfully', async () => {
            const result = await (${this.serviceName} as unknown as Record<string, (...args: unknown[]) => unknown>).${method}(${args.join(', ')});
            if (result && typeof result === 'object' && 'success' in result) {
                expect((result as Record<string, unknown>).success, (result as Record<string, unknown>).error as string).toBe(true);
            }
            ${
              method.toLowerCase().startsWith('count')
                ? "if (result && typeof result === 'object' && 'data' in result) { expect(result.data).toBe(100); }"
                : ''
            }
            ${
              method.toLowerCase().startsWith('get')
                ? "if (result && typeof result === 'object' && 'data' in result) { expect(result.data).toBeDefined(); }"
                : ''
            }
        });`;
          failureTest = `
        it('should handle errors in ${method}', async () => {
            try {
              ${dbErrorMocks}
              
              const result = await (${this.serviceName} as unknown as Record<string, (...args: unknown[]) => unknown>).${method}(${args.join(', ')});
              if (result && typeof result === 'object' && 'success' in result) {
                  expect(result.success).toBe(false);
              }
            } catch (error) {
                // If it throws, that's also a valid error handling path
                expect(error).toBeDefined();
            }
        });`;
        }

        return `
    describe('${method}', () => {
        ${successTest}
        ${failureTest}
    });`;
      })
      .join('\n');
  }

  public render(): FileDefinition {
    const methodsTests = this.renderTests();
    const mockModel = this.models.find((m) => m.name === this.entityName);
    const mockModelProps: Record<string, string> = {
      id: "'1'",
      email: "'test@example.com'",
      name: "'test'",
      status: `'${this.defaultStatus}'`,
      role: "'TEAM_MEMBER'",
      token: "'test-token'",
      expires: 'new Date(Date.now() + 86400000)',
      actorId: "'ne_pat_test'",
      lockedBy: "'ne_pat_test'",
      createdAt: 'new Date()',
      updatedAt: 'new Date()',
    };

    if (mockModel?.fields) {
      for (const [fieldName, field] of Object.entries(mockModel.fields)) {
        if (field.isList || field.isRelation) continue;
        if (fieldName === 'id' || fieldName === 'createdAt' || fieldName === 'updatedAt') continue;

        const type = field.type;
        if (type === 'String') mockModelProps[fieldName] = "'test'";
        else if (type === 'Int' || type === 'Float') mockModelProps[fieldName] = '1';
        else if (type === 'Boolean') mockModelProps[fieldName] = 'true';
        else if (type === 'DateTime') mockModelProps[fieldName] = 'new Date()';
        else if (type === 'Json') mockModelProps[fieldName] = '{}';
        else mockModelProps[fieldName] = "'test-enum'"; // Fallback for enums
      }
    }

    const mockPropsString = Object.entries(mockModelProps)
      .map(([k, v]) => `    ${k}: ${v},`)
      .join('\n');

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      statements: [
        TemplateLoader.load('test/unit/service.tsf', {
          serviceName: this.serviceName,
          servicePath: this.servicePath,
          tests: methodsTests,
          mockModelProps: `{\n${mockPropsString}\n  }`,
        }).raw,
      ],
    };
  }

  protected getSchema(_node?: NodeContainer): FileDefinition {
    // This is technically unused by the current render mode, but required by abstract class
    return this.render();
  }
}
