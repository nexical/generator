/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { createTestProject } from '@nexical/generator-tests/helpers/test-project';
import { InterfacePrimitive } from '@nexical/generator/engine/primitives/nodes/interface';

describe('InterfacePrimitive', () => {
  it('should create a new interface', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', '');

    const primitive = new InterfacePrimitive({
      name: 'TestInterface',
      isExported: true,
      properties: [
        { name: 'id', type: 'string' },
        { name: 'count', type: 'number', optional: true },
      ],
    });

    primitive.ensure(sourceFile);

    const interfaceDecl = sourceFile.getInterface('TestInterface');
    expect(interfaceDecl).toBeDefined();
    expect(interfaceDecl?.isExported()).toBe(true);

    const idProp = interfaceDecl?.getProperty('id');
    expect(idProp?.getType().getText()).toBe('string');
    expect(idProp?.hasQuestionToken()).toBe(false);

    const countProp = interfaceDecl?.getProperty('count');
    expect(countProp?.getType().getText()).toBe('number');
    expect(countProp?.hasQuestionToken()).toBe(true);
  });

  it('should update an existing interface', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      'interface TestInterface { id: number; }',
    );

    const primitive = new InterfacePrimitive({
      name: 'TestInterface',
      properties: [
        { name: 'id', type: 'string' }, // Changed type
        { name: 'name', type: 'string' }, // New prop
      ],
    });

    primitive.ensure(sourceFile);

    const interfaceDecl = sourceFile.getInterface('TestInterface');
    expect(interfaceDecl?.getProperty('id')?.getType().getText()).toBe('string');
    expect(interfaceDecl?.getProperty('name')).toBeDefined();
  });

  it('should update extends clauses', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      'interface TestInterface extends OldBase {}',
    );

    const primitive = new InterfacePrimitive({
      name: 'TestInterface',
      extends: ['NewBase', 'AnotherBase'],
    });

    primitive.ensure(sourceFile);

    const interfaceDecl = sourceFile.getInterface('TestInterface');
    const extendsClauses = interfaceDecl?.getExtends().map((e) => e.getText());
    expect(extendsClauses).toHaveLength(2);
    expect(extendsClauses).toContain('NewBase');
    expect(extendsClauses).toContain('AnotherBase');
    expect(extendsClauses).not.toContain('OldBase');
  });

  it('should validate correctly', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile(
      'test.ts',
      'interface TestInterface { id: number; }',
    );
    const node = sourceFile.getInterface('TestInterface')!;

    const primitive = new InterfacePrimitive({
      name: 'TestInterface',
      properties: [
        { name: 'id', type: 'string' }, // Mismatch
        { name: 'missing', type: 'boolean' }, // Missing
      ],
    });

    const result = primitive.validate(node);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('type mismatch'))).toBe(true);
    expect(result.issues.some((i) => i.includes('missing property'))).toBe(true);
  });
});
