/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { ActorTypeBuilder } from '../../../../src/engine/builders/actor-type-builder';
import { type ModelDef } from '../../../../src/engine/types';

describe('ActorTypeBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', 'existing content');
  });

  it('should clear file and generate global actor map', () => {
    const models: ModelDef[] = [
      { name: 'User', actor: { strategy: 'login' }, fields: {}, api: true },
    ];
    const builder = new ActorTypeBuilder(models);

    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).not.toContain('existing content');
    // ts-morph uses double quotes for imports by default, but ActorTypeBuilder might be using single quotes for some internal parts
    expect(text).toMatch(/import type \{ User \} from ".\/sdk\/types\.js";/);
    expect(text).toContain('namespace App');
    expect(text).toContain('interface ActorMap');
    expect(text).toContain("user: User & { type: 'user' };");
  });

  it('should generate empty schema if no actor models', () => {
    const models: ModelDef[] = [{ name: 'Profile', fields: {}, api: true }];
    const builder = new ActorTypeBuilder(models);

    builder.ensure(sourceFile);

    expect(sourceFile.getFullText().trim()).toBe('');
  });
});
