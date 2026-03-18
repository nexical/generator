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

  it('should return undefined if node is not JSDocable', () => {
    const textFile = project.createSourceFile('new.ts', 'const x = "y";', { overwrite: true });
    const literal = textFile.getVariableDeclaration('x')!.getInitializer()!;
    const primitive = new JSDocPrimitive({ description: 'Doc' });

    // Line 11 false branch
    expect(primitive.find(literal)).toBeUndefined();
  });

  it('should fallback to empty string if description is undefined during update and validate', () => {
    const classNode = sourceFile.getClass('TestClass')!;
    const primitive = new JSDocPrimitive(
      {} as unknown as import('@nexical/generator/engine/primitives/nodes/docs.js').JSDocConfig,
    ); // trigger || '' fallback

    // Line 30 fallback
    primitive.update(classNode.getJsDocs()[0]);
    expect(classNode.getJsDocs()[0].getDescription().trim()).toBe('');

    // Line 42-44 true validation check
    const result = primitive.validate(classNode.getJsDocs()[0]);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
