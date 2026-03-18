/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ServiceIntegrationTestBuilder } from '@nexical/generator/engine/builders/test/integration/service-integration-test-builder.js';

describe('ServiceIntegrationTestBuilder', () => {
  it('should strip [] from array types in imports', () => {
    const builder = new ServiceIntegrationTestBuilder(
      'poll-jobs-orchestrator',
      'PollJobsOrchestratorAction',
      'PollJobsDTO',
      'Job[]',
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    // It should import PollJobsDTO, but NOT Job (as it is unused in the generated test body)
    expect(text).toContain('import type { PollJobsDTO } from "../../../src/sdk"');
    expect(text).not.toContain('Job } from "../../../src/sdk"');
  });

  it('should handle void types correctly', () => {
    const builder = new ServiceIntegrationTestBuilder(
      'simple-action',
      'SimpleAction',
      'void',
      'void',
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).not.toContain('import type { void }');
    expect(text).toContain('await SimpleAction.run(undefined, ctx)');
  });
});
