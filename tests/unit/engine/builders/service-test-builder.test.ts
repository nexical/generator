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
    // It should import Job, not Job[]
    expect(text).toContain('import type { PollJobsDTO, Job }');
    expect(text).not.toContain('import type { PollJobsDTO, Job[] }');
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
