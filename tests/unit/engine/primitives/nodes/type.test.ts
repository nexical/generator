/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { createTestProject } from '@nexical/generator-tests/helpers/test-project';
import { TypePrimitive } from '@nexical/generator/engine/primitives/nodes/type';

describe('TypePrimitive', () => {
  it('should create a new type alias', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', '');

    const primitive = new TypePrimitive({
      name: 'TestType',
      isExported: true,
      type: 'string | number',
    });

    primitive.ensure(sourceFile);

    const typeAlias = sourceFile.getTypeAlias('TestType');
    expect(typeAlias).toBeDefined();
    expect(typeAlias?.isExported()).toBe(true);
    expect(typeAlias?.getTypeNode()?.getText()).toBe('string | number');
  });

  it('should update an existing type alias', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'type TestType = string;');

    const primitive = new TypePrimitive({
      name: 'TestType',
      type: 'string[]',
      isExported: true,
    });

    primitive.ensure(sourceFile);

    const typeAlias = sourceFile.getTypeAlias('TestType');
    expect(typeAlias?.getTypeNode()?.getText()).toBe('string[]');
    expect(typeAlias?.isExported()).toBe(true);
  });

  it('should validate correctly', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'type TestType = string;');
    const typeNode = sourceFile.getTypeAlias('TestType')!;

    const primitive = new TypePrimitive({
      name: 'TestType',
      type: 'number', // Mismatch
    });

    const result = primitive.validate(typeNode);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('definition mismatch'))).toBe(true);
  });
});
