import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project } from 'ts-morph';
import { ServiceUnitTestBuilder } from '@nexical/generator/engine/builders/test/unit/service-unit-test-builder.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';
import { type ModelField } from '@nexical/generator/engine/types.js';

// Match the original test's mock pattern but fix for .raw usage
vi.mock('@nexical/generator/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn((_name, _data) => ({ raw: `// Mock content for ${_name}` })),
  },
}));

interface ServiceTemplateData {
  serviceName: string;
  servicePath: string;
  tests: string;
}

describe('ServiceUnitTestBuilder Extra Coverage', () => {
  let project: Project;

  beforeEach(() => {
    vi.clearAllMocks();
    project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('test.ts', '');
  });

  it('should cover isModelValid branches for update and delete', () => {
    const builder = new ServiceUnitTestBuilder(
      'UserService',
      'User',
      '../services/user-service',
      { update: 2, delete: 1 },
      [],
      [{ name: 'User' }],
    );

    // @ts-expect-error - getSchema is protected
    builder.getSchema();

    const calls = vi.mocked(TemplateLoader.load).mock.calls;

    const call = calls.find((c) => c[0] === 'test/unit/service.tsf');
    expect(call).toBeDefined();
    const data = call![1] as unknown as ServiceTemplateData;
    expect(data).toBeDefined();
    expect(data.tests).toContain("it('should update an existing User'");
    expect(data.tests).toContain("it('should delete an User'");
  });

  it('should cover DateTime and Json field types', () => {
    const builder = new ServiceUnitTestBuilder(
      'UserService',
      'User',
      '../services/user-service',
      { create: 1 },
      [],
      [
        {
          name: 'User',
          fields: {
            createdAt: {
              type: 'DateTime',
              isList: false,
              isRequired: true,
              isRelation: false,
              attributes: [],
              api: true,
            },
            meta: {
              type: 'Json',
              isList: false,
              isRequired: true,
              isRelation: false,
              attributes: [],
              api: true,
            },
            lastAction: {
              type: 'DateTime',
              isList: false,
              isRequired: true,
              isRelation: false,
              attributes: [],
              api: true,
            },
          },
        },
      ],
    );

    // @ts-expect-error - getSchema is protected
    builder.getSchema();

    const call = vi
      .mocked(TemplateLoader.load)
      .mock.calls.find((c) => c[0] === 'test/unit/service.tsf');
    expect(call).toBeDefined();
    const data = call![1] as unknown as { mockModelProps: string };
    expect(data.mockModelProps).toContain('lastAction: new Date()');
    expect(data.mockModelProps).toContain('meta: {}');
    expect(data.mockModelProps).not.toContain('createdAt:');
  });

  it('should cover orchestration-specific field injection in mock object', () => {
    const model: { name: string; fields?: Record<string, ModelField> } = {
      name: 'Job',
      fields: {
        id: { type: 'String', isRequired: true, isList: false, attributes: [], api: true },
      },
    };
    const builder = new ServiceUnitTestBuilder(
      'JobOrchestrationService',
      'Job',
      '../job-orchestration.service',
      { list: 1 },
      ['Job'],
      [model],
    );

    const sourceFile = project.createSourceFile('orch.ts', '');
    builder.ensure(sourceFile);

    const call = vi
      .mocked(TemplateLoader.load)
      .mock.calls.find((c) => c[0] === 'test/unit/service.tsf');
    const data = call![1] as unknown as { mockModelProps: string };
    expect(data.mockModelProps).toContain('actorId:');
    expect(data.mockModelProps).toContain('lockedBy:');
    expect(data.mockModelProps).toContain("status: 'RUNNING'");
  });

  it('should cover actor injection in orchestrator methods', () => {
    const builder = new ServiceUnitTestBuilder(
      'DeadLetterService',
      'Message',
      '../dead-letter.service',
      { retry: 1 },
    );
    const sourceFile = project.createSourceFile('dead.ts', '');
    builder.ensure(sourceFile);

    const call = vi
      .mocked(TemplateLoader.load)
      .mock.calls.find((c) => c[0] === 'test/unit/service.tsf');
    const data = call![1] as unknown as { tests: string };
    expect(data.tests).toContain('retry');
    // It should have the actorId added automatically in the test arguments
    expect(data.tests).toContain("'deadLetter_test'");
  });

  it('should cover fallback for unknown param types and orchestrator actor injection', () => {
    const builder = new ServiceUnitTestBuilder(
      'OrchestratorService',
      'Job',
      '../services/job-service',
      { customMethod: 1 },
      [],
      [{ name: 'Job', fields: {} }],
    );

    // @ts-expect-error - getSchema is protected
    builder.getSchema();

    const call = vi
      .mocked(TemplateLoader.load)
      .mock.calls.find((c) => c[0] === 'test/unit/service.tsf');
    expect(call).toBeDefined();
    const data = call![1] as unknown as { tests: string };
    expect(data.tests).toContain('should run customMethod successfully');
    // Should include 'job_test' as actor because it's an orchestrator and no other actor param found
    expect(data.tests).toContain("'job_test'");
  });

  it('should cover isList branches in generateMockObject', () => {
    const builder = new ServiceUnitTestBuilder(
      'UserService',
      'User',
      '../services/user-service',
      { create: 1 },
      [],
      [
        {
          name: 'User',
          fields: {
            tags: {
              type: 'String',
              isList: true,
              isRequired: true,
              isRelation: false,
              attributes: [],
              api: true,
            },
            counts: {
              type: 'Int',
              isList: true,
              isRequired: true,
              isRelation: false,
              attributes: [],
              api: true,
            },
            flags: {
              type: 'Boolean',
              isList: true,
              isRequired: true,
              isRelation: false,
              attributes: [],
              api: true,
            },
            statuses: {
              type: 'Status',
              isList: true,
              isRequired: true,
              isRelation: false,
              attributes: [],
              api: true,
            },
          },
        },
      ],
      [{ name: 'Status', members: [{ name: 'ACTIVE', value: 'ACTIVE' }], isExported: true }],
    );

    // @ts-expect-error - getSchema is protected
    builder.getSchema();

    const call = vi
      .mocked(TemplateLoader.load)
      .mock.calls.find((c) => c[0] === 'test/unit/service.tsf');
    const data = call![1] as unknown as { mockModelProps: string };
    expect(data.mockModelProps).toContain("tags: ['test-item']");
    expect(data.mockModelProps).toContain('counts: [1, 2]');
    expect(data.mockModelProps).toContain('flags: [true, false]');
    expect(data.mockModelProps).toContain("statuses: ['ACTIVE']");
  });
});
