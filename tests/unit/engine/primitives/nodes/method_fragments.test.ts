/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { MethodPrimitive } from '../../../../../src/engine/primitives/nodes/method.js';
import { ts } from '../../../../../src/engine/primitives/statements/factory.js';

describe('MethodPrimitive Fragments', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', 'class Test {}');
  });

  it('should inject simple fragment statements', () => {
    const classNode = sourceFile.getClass('Test')!;
    const primitive = new MethodPrimitive({
      name: 'foo',
      statements: [ts`const x = 1;`],
    });
    primitive.create(classNode);
    const method = classNode.getMethod('foo')!;
    expect(method.getBodyText()).toContain('const x = 1;');
  });

  it('should reconcile and update existing structure', () => {
    const classNode = sourceFile.getClass('Test')!;
    // Initial state
    const method = classNode.addMethod({
      name: 'updateTest',
      statements: "if (true) { console.log('old'); }",
    });

    const primitive = new MethodPrimitive({
      name: 'updateTest',
      statements: [ts`if (true) { console.log('new'); }`],
    });

    // Run update
    primitive.update(method);

    const body = method.getBodyText();
    // Phase 1 Logic: Preserve user changes if structure matches
    expect(body).toContain("console.log('old')");
    expect(body).not.toContain("console.log('new')");
    // Ensure no duplicate if statement
    expect(body?.match(/if \(true\)/g)?.length).toBe(1);
  });
});
