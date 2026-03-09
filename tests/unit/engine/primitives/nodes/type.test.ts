/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
import { createTestProject } from '@nexical/generator-tests/helpers/test-project.js';
import { TypePrimitive } from '@nexical/generator/engine/primitives/nodes/type.js';

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
    expect(result.issues.some((i: string) => i.includes('definition mismatch'))).toBe(true);
  });

  it('should validate correctly when matching', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'type TestType = string;');
    const typeNode = sourceFile.getTypeAlias('TestType')!;

    const primitive = new TypePrimitive({
      name: 'TestType',
      type: 'string',
    });

    const result = primitive.validate(typeNode);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should not update if type is same (ignoring whitespace)', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'type T = string | number;');
    const primitive = new TypePrimitive({
      name: 'T',
      type: 'string|number', // Whitespace difference only
    });

    const setTypeSpy = vi.spyOn(sourceFile.getTypeAlias('T')!, 'setType');
    primitive.ensure(sourceFile);
    expect(setTypeSpy).not.toHaveBeenCalled();
  });

  it('should handle missing exported config', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'export type T = string;');
    const primitive = new TypePrimitive({
      name: 'T',
      type: 'string',
      // isExported is undefined
    });
    primitive.ensure(sourceFile);
    expect(sourceFile.getTypeAlias('T')?.isExported()).toBe(true);
  });

  it('should handle missing type node during update', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'type T = string;');
    const typeAlias = sourceFile.getTypeAlias('T')!;

    // Mock getTypeNode to return undefined to hit line 24 fallback
    vi.spyOn(typeAlias, 'getTypeNode').mockReturnValue(undefined);
    const setTypeSpy = vi.spyOn(typeAlias, 'setType').mockReturnValue(typeAlias);

    const primitive = new TypePrimitive({
      name: 'T',
      type: 'number',
    });

    primitive.update(typeAlias);
    expect(setTypeSpy).toHaveBeenCalledWith('number');
  });

  it('should handle missing type node during validate', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', 'type T = string;');
    const typeAlias = sourceFile.getTypeAlias('T')!;

    // Mock getTypeNode to return undefined to hit line 33 fallback
    vi.spyOn(typeAlias, 'getTypeNode').mockReturnValue(undefined);

    const primitive = new TypePrimitive({
      name: 'T',
      type: 'number',
    });

    const result = primitive.validate(typeAlias);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('Expected: number, Found: ');
  });
});
