/** @vitest-environment node */
/* eslint-disable */
import { describe, it, expect } from 'vitest';
import { Project, ModuleDeclarationKind } from 'ts-morph';
import { ConstructorPrimitive } from '@nexical/generator/engine/primitives/nodes/constructor';
import { TypePrimitive } from '@nexical/generator/engine/primitives/nodes/type';
import { DecoratorPrimitive } from '@nexical/generator/engine/primitives/nodes/decorator';
import { IfStatementPrimitive } from '@nexical/generator/engine/primitives/statements/if';
import { VariablePrimitive } from '@nexical/generator/engine/primitives/nodes/variable';
import { MethodPrimitive } from '@nexical/generator/engine/primitives/nodes/method';
import { ModulePrimitive } from '@nexical/generator/engine/primitives/nodes/module';
import { ts } from '@nexical/generator/engine/primitives/statements/factory';

describe('Low Hanging Sweeper', () => {
  const createProject = (code: string) => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', code);
    return { project, sourceFile };
  };

  describe('ConstructorPrimitive', () => {
    it('should update constructor body', () => {
      const code = 'class Test { constructor() { console.log("old"); } }';
      const { sourceFile } = createProject(code);
      const cls = sourceFile.getClassOrThrow('Test');
      const ctor = cls.getConstructors()[0];

      const p = new ConstructorPrimitive({
        statements: [ts`console.log("new");`],
      });
      p.update(ctor);
      expect(ctor.getBodyText()?.trim()).toContain('console.log("new");');
    });

    it('should NOT update constructor body if identical', () => {
      const code = 'class Test { constructor() { console.log("same"); } }';
      const { sourceFile } = createProject(code);
      const cls = sourceFile.getClassOrThrow('Test');
      const ctor = cls.getConstructors()[0];

      const p = new ConstructorPrimitive({
        statements: [ts`console.log("same");`],
      });
      p.update(ctor);
      expect(ctor.getBodyText()?.trim()).toContain('console.log("same");');
    });

    it('should validate constructor (stub)', () => {
      const p = new ConstructorPrimitive({ statements: [] });
      expect(p.validate({} as any).valid).toBe(true);
    });
  });

  describe('TypePrimitive', () => {
    it('should update type definition and export status', () => {
      const code = 'type ID = number;';
      const { sourceFile } = createProject(code);
      const typeAlias = sourceFile.getTypeAliasOrThrow('ID');

      const p = new TypePrimitive({
        name: 'ID',
        type: 'string',
        isExported: true,
      });
      p.update(typeAlias);
      expect(typeAlias.getTypeNode()?.getText()).toBe('string');
      expect(typeAlias.isExported()).toBe(true);
    });

    it('should NOT update type/export if matches', () => {
      const code = 'export type ID = number;';
      const { sourceFile } = createProject(code);
      const typeAlias = sourceFile.getTypeAliasOrThrow('ID');

      const p = new TypePrimitive({
        name: 'ID',
        type: 'number',
        isExported: true,
      });
      p.update(typeAlias);
      expect(typeAlias.isExported()).toBe(true);
    });

    it('should validate type mismatch', () => {
      const code = 'type ID = number;';
      const { sourceFile } = createProject(code);
      const typeAlias = sourceFile.getTypeAliasOrThrow('ID');

      const p = new TypePrimitive({
        name: 'ID',
        type: 'string',
      });
      const res = p.validate(typeAlias);
      expect(res.valid).toBe(false);
      expect(res.issues[0]).toContain('mismatch');
    });
  });

  describe('DecoratorPrimitive', () => {
    it('should update arguments when drifted', () => {
      const code = '@Log("old") class Test {}';
      const { sourceFile } = createProject(code);
      const cls = sourceFile.getClassOrThrow('Test');
      const deco = cls.getDecorators()[0];

      const p = new DecoratorPrimitive({
        name: 'Log',
        arguments: ['"new"'],
      });
      p.update(deco);
      expect(cls.getDecorators()[0].getArguments()[0].getText()).toBe('"new"');
    });

    it('should validate valid decorator', () => {
      const code = '@Log("a") class Test {}';
      const { sourceFile } = createProject(code);
      const cls = sourceFile.getClassOrThrow('Test');
      const deco = cls.getDecorators()[0];

      const p = new DecoratorPrimitive({
        name: 'Log',
        arguments: ['"a"'],
      });
      const res = p.validate(deco);
      expect(res.valid).toBe(true);
    });

    it('should validate argument mismatch', () => {
      const code = '@Log("old") class Test {}';
      const { sourceFile } = createProject(code);
      const cls = sourceFile.getClassOrThrow('Test');
      const deco = cls.getDecorators()[0];

      const p = new DecoratorPrimitive({
        name: 'Log',
        arguments: ['"new"'],
      });
      const res = p.validate(deco);
      expect(res.valid).toBe(false);
      expect(res.issues[0]).toContain('mismatch');
    });

    it('should validate argument count mismatch', () => {
      const code = '@Log("a") class Test {}';
      const { sourceFile } = createProject(code);
      const cls = sourceFile.getClassOrThrow('Test');
      const deco = cls.getDecorators()[0];

      const p = new DecoratorPrimitive({
        name: 'Log',
        arguments: ['"a"', '"b"'],
      });
      const res = p.validate(deco);
      expect(res.valid).toBe(false);
      expect(res.issues[0]).toContain('count mismatch');
    });
  });

  describe('IfStatementPrimitive', () => {
    it('should generate else block', () => {
      const p = new IfStatementPrimitive({
        kind: 'if',
        condition: 'true',
        then: [ts`return 1;`],
        else: [ts`return 0;`],
      });
      const str = p.generate();
      expect(str).toContain('else {');
      expect(str).toContain('return 0;');
    });
  });

  describe('VariablePrimitive (No-op branches)', () => {
    it('should NOT update variable if exported matches', () => {
      const code = 'export const val = 1;';
      const { sourceFile } = createProject(code);
      const stmt = sourceFile.getVariableStatement(
        (s: any) => s.getDeclarations()[0].getName() === 'val',
      );

      if (!stmt) throw new Error('Statement not found');

      const p = new VariablePrimitive({
        name: 'val',
        isExported: true,
      });
      p.update(stmt);
      expect(stmt.isExported()).toBe(true);
    });

    it('should validate missing declaration gracefully', () => {
      const { sourceFile } = createProject('const other = 1;');
      const stmt = sourceFile.getVariableStatements()[0];
      const p = new VariablePrimitive({ name: 'missing' });
      const res = p.validate(stmt);
      expect(res.valid).toBe(false);
      expect(res.issues[0]).toContain('not found');
    });
  });

  describe('MethodPrimitive', () => {
    it('should reconcile body (replaces overwriteBody: true)', () => {
      const code = 'class Test { method() { return 1; } }';
      const { sourceFile } = createProject(code);
      const cls = sourceFile.getClassOrThrow('Test');
      const method = cls.getMethods()[0];

      const p = new MethodPrimitive({
        name: 'method',
        statements: [{ kind: 'return', expression: '2' }],
      });
      p.update(method);
      // Normalized matching: 'return 1;' matches 'return 2;' structurally (both Returns)
      // Since it's NOT marked as isDefault, it should update.
      expect(method.getBodyText()?.trim()).toBe('return 2;');
    });

    it('should NOT overwrite if identical', () => {
      const code = 'class Test { method() { return 2; } }';
      const { sourceFile } = createProject(code);
      const cls = sourceFile.getClassOrThrow('Test');
      const method = cls.getMethods()[0];

      const p = new MethodPrimitive({
        name: 'method',
        statements: [{ kind: 'return', expression: '2' }],
      });
      p.update(method);
      expect(method.getBodyText()?.trim()).toBe('return 2;');
    });
  });

  describe('ModulePrimitive', () => {
    it('should create global module', () => {
      const { sourceFile } = createProject('');
      const p = new ModulePrimitive({
        name: 'global',
      });
      const mod = p.create(sourceFile);
      expect(mod.getDeclarationKind()).toBe(ModuleDeclarationKind.Global);
    });

    it('should create quoted declaration module', () => {
      const { sourceFile } = createProject('');
      const p = new ModulePrimitive({
        name: '"my-mod"',
        isDeclaration: true,
      });
      const mod = p.create(sourceFile);
      expect(mod.getDeclarationKind()).toBe(ModuleDeclarationKind.Module);
      expect(mod.hasDeclareKeyword()).toBe(true);
    });
  });
});
