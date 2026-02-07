/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { JSDocPrimitive } from '@nexical/generator/engine/primitives/nodes/docs.js';

describe('JSDocPrimitive', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile(
      'test.ts',
      `
            /** Old Description */
            export class TestClass {}
        `,
    );
  });

  it('should update JSDoc description when it drifts', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new JSDocPrimitive({
      description: 'New Description',
    });

    // Simulating usage via ensure
    primitive.ensure(classNode);

    const docs = classNode.getJsDocs();
    expect(docs.length).toBe(1);
    expect(docs[0].getDescription()).toBe('New Description');
  });

  it('should match trimmed content (no whitespace drift)', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new JSDocPrimitive({
      description: 'Old Description', // Same content
    });

    primitive.ensure(classNode);
    expect(classNode.getJsDocs()[0].getDescription()).toBe('Old Description');
  });

  it('should validate JSDoc content', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new JSDocPrimitive({
      description: 'Expected Description',
    });

    const docNode = classNode.getJsDocs()[0];
    const result = primitive.validate(docNode);

    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('JSDoc description mismatch');
  });

  it('should add new JSDoc if missing', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const textFile = project.createSourceFile('new.ts', 'class NewClass {}');
    const classNode = textFile.getClass('NewClass')!;

    const primitive = new JSDocPrimitive({
      description: 'Fresh Docs',
    });

    primitive.ensure(classNode);
    expect(classNode.getJsDocs()[0].getDescription()).toBe('Fresh Docs');
  });
});
