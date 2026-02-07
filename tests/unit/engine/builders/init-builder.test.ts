/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { InitBuilder } from '../../../../src/engine/builders/init-builder';

describe('InitBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
  });

  it('should generate server init function', () => {
    const builder = new InitBuilder('server');
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('export async function init');
    expect(text).toContain('roleRegistry');
    expect(text).toContain('import.meta.glob("./roles/*.ts"');
    expect(text).toContain('import.meta.glob("./hooks/*.ts"');
    expect(text).toContain('import.meta.glob("./emails/init.ts"');
  });

  it('should generate client init function', () => {
    const builder = new InitBuilder('client');
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('export async function init');
    expect(text).toContain('console.info("[Client] Initializing module...");');
  });
});
