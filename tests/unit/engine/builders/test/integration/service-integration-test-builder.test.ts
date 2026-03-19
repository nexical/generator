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

  it('should merge existing imports with generated ones', () => {
    const builder = new ServiceIntegrationTestBuilder(
      'user-actions',
      'UpdateUser',
      'UpdateUserInput',
      'User',
    );
    const project = new Project({ useInMemoryFileSystem: true });
    // Pre-adding some imports to test merging
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
      import { existingFunc } from './other';
      import { describe } from 'vitest';
      import type { SomeType } from '../../../src/sdk';
      
      console.log(existingFunc);
      type T = SomeType;
    `,
    );

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    // Should contain original plus new ones
    expect(text).toContain("import { existingFunc } from './other';");
    expect(text).toContain("import { beforeAll, describe, expect, it } from 'vitest';");
    expect(text).toContain("import type { SomeType, UpdateUserInput } from '../../../src/sdk';");
  });

  it('should handle type-only merging correctly', () => {
    const builder = new ServiceIntegrationTestBuilder(
      'user-actions',
      'UpdateUser',
      'UpdateUserInput',
      'User',
    );
    const project = new Project({ useInMemoryFileSystem: true });
    // Pre-adding a NON-type-only import for same module
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
      import { SomeValue } from '../../../src/sdk';
      console.log(SomeValue);
    `,
    );

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    // Since we have a value import, it should NOT be type-only anymore if merged
    expect(text).toContain("import { SomeValue, UpdateUserInput } from '../../../src/sdk';");
  });

  it('should not import primitive input types', () => {
    const builder = new ServiceIntegrationTestBuilder(
      'user-actions',
      'UpdateUser',
      'string',
      'User',
    );
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).not.toContain('import type { string }');
    expect(text).toContain('const input: string = {} as unknown as string;');
  });
});
