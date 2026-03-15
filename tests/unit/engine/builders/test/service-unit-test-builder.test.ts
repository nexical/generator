/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ServiceUnitTestBuilder } from '@nexical/generator/engine/builders/test/service-unit-test-builder.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';

vi.mock('@nexical/generator/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn((_name, _data) => `// Mock content for ${_name}`),
  },
}));

interface ServiceTemplateData {
  serviceName: string;
  servicePath: string;
  tests: string;
}

describe('ServiceUnitTestBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate correct schema with CRUD methods', () => {
    const builder = new ServiceUnitTestBuilder('UserService', 'User', '../services/user-service', {
      list: 0,
      get: 1,
      create: 1,
      update: 2,
      delete: 1,
      count: 0,
    });

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();

    expect(_schema.header).toBe('// GENERATED CODE - DO NOT MODIFY');
    expect(_schema.statements).toHaveLength(1); // One TemplateLoader.load call

    expect(TemplateLoader.load).toHaveBeenCalledWith(
      'test/unit/service.tsf',
      expect.objectContaining({
        serviceName: 'UserService',
        servicePath: '../services/user-service',
      }),
    );

    const tests = (
      vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as ServiceTemplateData
    ).tests;
    expect(tests).toContain("describe('list', () => {");
    expect(tests).toContain("describe('get', () => {");
    expect(tests).toContain("describe('create', () => {");
    expect(tests).toContain("describe('update', () => {");
    expect(tests).toContain("describe('delete', () => {");
    expect(tests).toContain("describe('count', () => {");
  });

  it('should handle special services and names', () => {
    // Tests branch for "Orchestration" in name and different entity/status
    const builder = new ServiceUnitTestBuilder(
      'OrchestrationService',
      'Job',
      '../services/orchestration-service',
      { updateProgress: 2, complete: 4, fail: 4, retry: 4, poll: 4, register: 1, cancel: 1 },
    );

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const tests = (
      vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as ServiceTemplateData
    ).tests;

    expect(tests).toContain("describe('updateProgress', () => {");
    expect(tests).toContain(
      "await (OrchestrationService as any).updateProgress('ne_pat_test', 50)",
    );
    expect(tests).toContain(
      "await (OrchestrationService as any).complete('ne_pat_test', { result: 'ok' } as any, 'ne_pat_test', 'user')",
    );
    expect(tests).toContain(
      "await (OrchestrationService as any).poll('agent-1', ['TASK'] as any, 'ne_pat_test', 'user')",
    );
    expect(tests).toContain("await (OrchestrationService as any).cancel('ne_pat_test' as any)");
  });

  it('should handle DeadLetterQueueService specially', () => {
    const builder = new ServiceUnitTestBuilder(
      'DeadLetterQueueService',
      'DeadLetterJob',
      '../services/dead-letter-service',
      { list: 0 },
    );

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const tests = (
      vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as ServiceTemplateData
    ).tests;
    expect(tests).toContain(
      "expect(result.error).toBe('deadLetterQueue.service.error.list_failed')",
    );
  });

  it('should handle specific DeadLetter services', () => {
    const builder = new ServiceUnitTestBuilder(
      'DeadLetterProcessingService',
      'DeadLetterJob',
      '../services/dead-letter-proc-service',
      { list: 0 },
    );

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const data = vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as ServiceTemplateData;
    expect(data.tests).toContain(".error.list_failed')");
  });

  it('should handle models in models array for isModelValid', () => {
    const builder = new ServiceUnitTestBuilder(
      'CustomService',
      'Custom',
      '../services/custom-service',
      { list: 0 },
      [],
      [{ name: 'Custom' }],
    );

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const data = vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as ServiceTemplateData;
    // isModelValid = true, so list tests should be present
    expect(data.tests).toContain("describe('list', () => {");
  });

  it('should handle Auth services and long-running methods', () => {
    const builder = new ServiceUnitTestBuilder('AuthService', 'User', '../services/auth-service', {
      login: 1,
      waitSomething: 0,
    });

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const tests = (
      vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as ServiceTemplateData
    ).tests;
    expect(tests).toContain("describe('login', () => {");
    expect(tests).not.toContain("describe('waitSomething', () => {"); // Long-running methods are skipped
  });

  it('should handle custom methods and different parameter scenarios', () => {
    const builder = new ServiceUnitTestBuilder('UserService', 'User', '../services/user-service', {
      customAction: 3,
      checkStaleAgents: 2,
      heartbeat: 1,
    });

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const tests = (
      vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as ServiceTemplateData
    ).tests;

    expect(tests).toContain("describe('customAction', () => {");
    expect(tests).toContain("describe('checkStaleAgents', () => {");
    // checkStaleAgents first param uses defaultObj because it's not in the useString whitelist for i=0
    expect(tests).toContain(
      "await (UserService as any).checkStaleAgents({ id: 'ne_pat_test', email: 'test@example.com', name: 'Test', token: 'token', teamId: '1', role: 'TEAM_MEMBER', status: 'PENDING', password: 'password', confirmPassword: 'password' } as any, 'ne_pat_test' as any)",
    );
    expect(tests).toContain("await (UserService as any).heartbeat('ne_pat_test' as any)");
  });

  it('should cover count and get method name branches', () => {
    const builder = new ServiceUnitTestBuilder('UserService', 'User', '../services/user-service', {
      countActive: 1,
      getActive: 1,
    });

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const tests = (
      vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as ServiceTemplateData
    ).tests;
    expect(tests).toContain("describe('countActive', () => {");
    expect(tests).toContain("describe('getActive', () => {");
    expect(tests).toContain('expect(result.data).toBe(100)'); // default count return
  });
});
