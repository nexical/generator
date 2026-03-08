/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ServiceTestBuilder } from '../../../../src/engine/builders/service-test-builder';

describe('ServiceTestBuilder', () => {
  it('should strip [] from array types in imports', () => {
    const builder = new ServiceTestBuilder(
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
    const builder = new ServiceTestBuilder('simple-action', 'SimpleAction', 'void', 'void');
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).not.toContain('import type { void }');
    expect(text).toContain('await SimpleAction.run(undefined, ctx)');
  });
});
