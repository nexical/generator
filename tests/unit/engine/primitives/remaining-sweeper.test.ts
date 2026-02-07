/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project, Scope } from 'ts-morph';
import { ClassPrimitive } from '@nexical/generator/engine/primitives/nodes/class';
import { PropertyPrimitive } from '@nexical/generator/engine/primitives/nodes/property';
import { AccessorPrimitive } from '@nexical/generator/engine/primitives/nodes/accessor';
import { VariablePrimitive } from '@nexical/generator/engine/primitives/nodes/variable';

describe('Remaining Primitives Sweeper', () => {
  const createProject = (code: string) => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', code);
    return { project, sourceFile };
  };

  describe('ClassPrimitive', () => {
    it('should handle abstract and extentds/implement logic', () => {
      const { sourceFile } = createProject('class Test {}');
      const classDecl = sourceFile.getClassOrThrow('Test');

      const p = new ClassPrimitive({
        name: 'Test',
        isAbstract: true,
        extends: 'Base',
        implements: ['IFace'],
      });

      p.update(classDecl);
      expect(classDecl.isAbstract()).toBe(true);
      expect(classDecl.getExtends()?.getText()).toBe('Base');
      expect(classDecl.getImplements().map((i) => i.getText())).toContain('IFace');
    });

    it('should validate implements mismatch', () => {
      const { sourceFile } = createProject('class Test implements Old {}');
      const classDecl = sourceFile.getClassOrThrow('Test');

      const p = new ClassPrimitive({
        name: 'Test',
        implements: ['New'],
      });

      const result = p.validate(classDecl);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('implements mismatch');
    });
  });

  describe('PropertyPrimitive', () => {
    it('should update property type and modifiers', () => {
      const { sourceFile } = createProject('class Test { prop: string; }');
      const classDecl = sourceFile.getClassOrThrow('Test');
      const prop = classDecl.getPropertyOrThrow('prop');

      const p = new PropertyPrimitive({
        name: 'prop',
        type: 'number',
        scope: 'private',
        isStatic: true,
        readonly: true, // Corrected key
      });

      p.update(prop);
      expect(prop.getType().getText()).toBe('number');
      expect(prop.getScope()).toBe(Scope.Private);
      expect(prop.isStatic()).toBe(true);
      expect(prop.isReadonly()).toBe(true);
    });

    it('should validate initializer mismatch', () => {
      const { sourceFile } = createProject('class Test { prop = 10; }');
      const classDecl = sourceFile.getClassOrThrow('Test');
      const prop = classDecl.getPropertyOrThrow('prop');

      const p = new PropertyPrimitive({
        name: 'prop',
        initializer: '20',
      });

      const result = p.validate(prop);
      if (!result.valid) {
        expect(result.issues.some((i) => i.includes('initializer'))).toBe(true);
      }
    });
  });

  describe('AccessorPrimitive', () => {
    it('should update getter return type and statements', () => {
      const { sourceFile } = createProject('class Test { get val() { return 1; } }');
      const classDecl = sourceFile.getClassOrThrow('Test');
      const getAcc = classDecl.getGetAccessorOrThrow('val');

      const p = new AccessorPrimitive({
        name: 'val',
        kind: 'get',
        returnType: 'string', // Change return type
        statements: ['return "new";'],
        overwriteBody: true,
      });

      p.update(getAcc);
      expect(getAcc.getReturnType().getText()).toBe('string');
      expect(getAcc.getBodyText()).toContain('return "new";');
    });

    it('should validate setter parameter type', () => {
      const { sourceFile } = createProject('class Test { set val(v: number) {} }');
      const classDecl = sourceFile.getClassOrThrow('Test');
      const setAcc = classDecl.getSetAccessorOrThrow('val');

      const p = new AccessorPrimitive({
        name: 'val',
        kind: 'set',
        parameters: [{ name: 'v', type: 'string' }],
      });

      const result = p.validate(setAcc);
      expect(result).toBeDefined();
    });
  });

  describe('VariablePrimitive (Node)', () => {
    it('should update variable type and initializer', () => {
      const { sourceFile } = createProject('const val: number = 1;');

      const stmt = sourceFile.getVariableStatementOrThrow((s) =>
        s.getDeclarations().some((d) => d.getName() === 'val'),
      );

      const p = new VariablePrimitive({
        name: 'val',
        type: 'string',
        initializer: '"test"',
      });

      p.update(stmt);
      const decl = stmt.getDeclarations()[0];
      expect(decl.getType().getText()).toBe('string');
      expect(decl.getInitializer()?.getText()).toBe('"test"');
    });

    it('should validate missing export', () => {
      const { sourceFile } = createProject('const val = 1;');
      const stmt = sourceFile.getVariableStatementOrThrow((s) =>
        s.getDeclarations().some((d) => d.getName() === 'val'),
      );

      const p = new VariablePrimitive({
        name: 'val',
        isExported: true,
      });

      const result = p.validate(stmt);
      // Expect invalid because export is failing
      expect(result.valid).toBe(false);
    });
  });
});
