import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { InterfacePrimitive } from '../../../../src/engine/primitives/nodes/interface.js';
import { VariablePrimitive } from '../../../../src/engine/primitives/nodes/variable.js';

describe('Coverage Boost Primitives', { timeout: 60000 }, () => {
  describe('InterfacePrimitive', () => {
    it('should update extends and properties', () => {
      const project = new Project();
      const sf = project.createSourceFile(
        'test-primitive.ts',
        'export interface I extends A { p1: string; }',
      );
      const node = sf.getInterface('I')!;

      const primitive = new InterfacePrimitive({
        name: 'I',
        extends: ['B', 'C'],
        properties: [
          { name: 'p1', type: 'number' }, // Update
          { name: 'p2', type: 'boolean' }, // Create
        ],
      });

      primitive.update(node);

      expect(node.getExtends().map((e) => e.getText())).toEqual(['B', 'C']);
      expect(node.getProperty('p1')!.getType().getText()).toBe('number');
      expect(node.getProperty('p2')).toBeDefined();
    });

    it('should validate interface properties', () => {
      const project = new Project();
      const sf = project.createSourceFile('test-val.ts', 'interface I { p1: string; }');
      const node = sf.getInterface('I')!;

      const primitive = new InterfacePrimitive({
        name: 'I',
        properties: [
          { name: 'p1', type: 'number' }, // Wrong type
          { name: 'p2', type: 'string' }, // Missing
        ],
      });

      const result = primitive.validate(node);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBe(2);
    });
  });

  describe('VariablePrimitive', () => {
    it('should update export and declaration kind', () => {
      const project = new Project();
      const sf = project.createSourceFile('test-var.ts', 'const x = 1;');
      const node = sf.getVariableStatement('x')!;

      const primitive = new VariablePrimitive({
        name: 'x',
        isExported: true,
        declarationKind: 'let',
        initializer: '2',
      });

      primitive.update(node);

      expect(node.isExported()).toBe(true);
      expect(node.getDeclarationKind()).toBe('let');
      expect(node.getDeclarations()[0].getInitializer()?.getText()).toBe('2');
    });

    it('should validate variable statements', () => {
      const project = new Project();
      const sf = project.createSourceFile('test-var-val.ts', 'const x = 1;');
      const node = sf.getVariableStatement('x')!;

      const primitive = new VariablePrimitive({
        name: 'x',
        isExported: true, // mismatch
        initializer: '2', // mismatch
      });

      const result = primitive.validate(node);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBe(2);
    });
  });
});
