/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { BaseBuilder } from '../../../../src/engine/builders/base-builder';
import { Reconciler } from '../../../../src/engine/reconciler';
import { type FileDefinition } from '../../../../src/engine/types';

class TestBuilder extends BaseBuilder {
  protected getSchema(): FileDefinition {
    return {
      classes: [{ name: 'TestClass' }],
    };
  }
}

describe('BaseBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;
  let builder: TestBuilder;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
    builder = new TestBuilder();
    vi.spyOn(Reconciler, 'reconcile');
    vi.spyOn(Reconciler, 'validate');
  });

  it('should call Reconciler.reconcile in ensure', () => {
    builder.ensure(sourceFile);
    expect(Reconciler.reconcile).toHaveBeenCalledWith(sourceFile, expect.any(Object));
    expect(sourceFile.getClass('TestClass')).toBeDefined();
  });

  it('should call Reconciler.validate in validate', () => {
    builder.validate(sourceFile);
    expect(Reconciler.validate).toHaveBeenCalledWith(sourceFile, expect.any(Object));
  });
});
