/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
import { Project } from 'ts-morph';
import { ClassPrimitive } from '../../../../src/engine/primitives/nodes/class.js';
import { FunctionPrimitive } from '../../../../src/engine/primitives/nodes/function.js';
import { ComponentPrimitive } from '../../../../src/engine/primitives/nodes/component.js';
import { InterfacePrimitive } from '../../../../src/engine/primitives/nodes/interface.js';
import { AccessorPrimitive } from '../../../../src/engine/primitives/nodes/accessor.js';
import { MethodPrimitive } from '../../../../src/engine/primitives/nodes/method.js';
import { StatementFactory, ts } from '../../../../src/engine/primitives/statements/factory.js';

describe('Coverage Boost Engine', () => {
  describe('AccessorPrimitive', () => {
    it('should handle accessor branches', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile(
        'test.ts',
        'class T { get a() { return 1; } set a(v) {} }',
      );
      const cls = sf.getClassOrThrow('T');
      const getAcc = cls.getGetAccessorOrThrow('a');
      const setAcc = cls.getSetAccessorOrThrow('a');

      const pGet = new AccessorPrimitive({ name: 'a', kind: 'get', statements: [ts`return 2;`] });
      pGet.update(getAcc);
      expect(getAcc.getBodyText()).toContain('return 2');

      const pSet = new AccessorPrimitive({
        name: 'a',
        kind: 'set',
        parameters: [{ name: 'val', type: 'number' }],
      });
      pSet.update(setAcc);
      expect(setAcc.getParameters()[0].getTypeNode()?.getText()).toBe('number');
    });

    it('should handle missing body or name mismatch in find', () => {
      const p = new AccessorPrimitive({ name: 'b', kind: 'get' });
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile('test.ts', 'class T {}');
      expect(p.find(sf.getClassOrThrow('T'))).toBeUndefined();
    });
  });

  describe('ComponentPrimitive', () => {
    it('should handle component return branches', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile('test.ts', 'function C() { return null; }');
      const fn = sf.getFunctionOrThrow('C');

      const p = new ComponentPrimitive({
        name: 'C',
        render: ts`return <div>UI</div>;`,
      });
      p.update(fn);
      expect(fn.getBodyText()).toContain('<div>UI</div>');
    });

    it('should handle component missing existing returns and arrow functions safely', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile('test.ts', 'const C2 = () => { let x = 1; };');
      const decl = sf.getVariableDeclarationOrThrow('C2');
      const stmt = decl.getVariableStatementOrThrow();

      const p = new ComponentPrimitive({
        name: 'C2',
        render: ts`return <div>New</div>;`,
      });
      p.update(stmt as unknown as Parameters<typeof p.update>[0]);
      expect(sf.getText()).toContain('return <div>New</div>;');
    });

    it('should return safely if configured render lacks syntax kind', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile('test.ts', 'function C3() { return null; }');
      const fn = sf.getFunctionOrThrow('C3');

      const p = new ComponentPrimitive({
        name: 'C3',
        render: ts`let block = true;`,
      });
      p.update(fn);
      expect(fn.getBodyText()).toContain('return null');
    });

    it('should ensure component', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile('test.ts', '');
      const p = new ComponentPrimitive({
        name: 'Comp',
        props: [{ name: 'a', type: 'string' }],
        render: ts`return <div />`,
      });
      p.ensure(sf);
      expect(sf.getVariableStatement('Comp')).toBeDefined();
    });
  });

  describe('InterfacePrimitive', () => {
    it('should handle extends branch', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile('test.ts', 'interface I {}');
      const node = sf.getInterfaceOrThrow('I');

      const p = new InterfacePrimitive({
        name: 'I',
        extends: ['Base'],
      });
      p.update(node);
      expect(node.getExtends().map((e) => e.getText())).toContain('Base');
    });
  });

  describe('StatementFactory', () => {
    it('should handle null/undefined configurations', () => {
      expect(
        StatementFactory.generate(
          null as unknown as import('../../../../src/engine/types.js').StatementConfig,
        ),
      ).toBe('');
      expect(
        StatementFactory.generate(
          null as unknown as import('../../../../src/engine/types.js').StatementConfig,
        ),
      ).toBe('');
      // Use as unknown as string/any to specifically test null handling while avoiding lint
    });
  });

  describe('Cross-Primitive Positive Validations', () => {
    it('should return valid true for perfectly matched ClassPrimitive properties', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile(
        'test.ts',
        `
/** Required */
export class TestClass extends Base {}
`,
      );
      const primitive = new ClassPrimitive({
        name: 'TestClass',
        isExported: true,
        extends: 'Base',
        docs: ['Required'],
      });
      const res = primitive.validate(sf.getClassOrThrow('TestClass'));
      expect(res.valid).toBe(true);
    });

    it('should return valid true for perfectly matched FunctionPrimitive modifiers', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile(
        'test.ts',
        'export async function test(): Promise<void> {}',
      );
      const primitive = new FunctionPrimitive({
        name: 'test',
        isExported: true,
        isAsync: true,
        returnType: 'Promise<void>',
      });
      const res = primitive.validate(sf.getFunctionOrThrow('test'));
      expect(res.valid).toBe(true);
    });

    it('should return valid true for perfectly matched MethodPrimitive modifiers', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile('test.ts', 'class T { async test(): Promise<void> {} }');
      const primitive = new MethodPrimitive({
        name: 'test',
        isAsync: true,
        returnType: 'Promise<void>',
      });
      const res = primitive.validate(sf.getClassOrThrow('T').getMethodOrThrow('test'));
      expect(res.valid).toBe(true);
    });

    it('should execute ParsedStatement ts templates successfully in MethodPrimitive', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile('test.ts', 'class T { test() {} }');
      const primitive = new MethodPrimitive({
        name: 'test',
        statements: [ts`const x = 5;`],
      });
      primitive.ensure(sf.getClassOrThrow('T'));
      expect(sf.getClassOrThrow('T').getMethodOrThrow('test').getBodyText()).toContain(
        'const x = 5;',
      );
    });

    it('should execute ParsedStatement ts templates with cleanup correctly', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile('test.ts', 'class T { test() {} }');
      const stmts = ts`let a = 1;`;
      // Mock a cleanup function for statement tracking logic coverage
      (stmts as unknown as { cleanup: () => void }).cleanup = vi.fn();

      const primitive = new MethodPrimitive({
        name: 'test',
        statements: [stmts],
      });
      primitive.ensure(sf.getClassOrThrow('T'));
      expect((stmts as unknown as { cleanup: () => void }).cleanup).toHaveBeenCalled();
    });

    it('should return valid true for perfectly matched ComponentPrimitive', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile(
        'test.ts',
        `
                export function C(props: { a: string }) { return <div />; }
            `,
      );
      const primitive = new ComponentPrimitive({
        name: 'C',
        isExported: true,
        props: [{ name: 'a', type: 'string' }],
        render: ts`return <div />;`,
      });
      const res = primitive.validate(sf.getFunctionOrThrow('C'));
      expect(res.valid).toBe(true);
    });

    it('should validate method parameters and docs mismatches', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile('test.ts', 'class T { test(a: string) {} }');

      const p1 = new MethodPrimitive({ name: 'test', parameters: [{ name: 'b', type: 'string' }] });
      expect(p1.validate(sf.getClassOrThrow('T').getMethodOrThrow('test')).valid).toBe(false);

      const p2 = new MethodPrimitive({ name: 'test', parameters: [{ name: 'a', type: 'number' }] });
      expect(p2.validate(sf.getClassOrThrow('T').getMethodOrThrow('test')).valid).toBe(false);

      const p3 = new MethodPrimitive({ name: 'test', parameters: [] });
      expect(p3.validate(sf.getClassOrThrow('T').getMethodOrThrow('test')).valid).toBe(false);

      const p4 = new MethodPrimitive({ name: 'test', docs: ['Docs'] });
      expect(p4.validate(sf.getClassOrThrow('T').getMethodOrThrow('test')).valid).toBe(false);

      const p5 = new MethodPrimitive({
        name: 'test',
        decorators: [{ name: 'Get', arguments: [] }],
      });
      expect(p5.validate(sf.getClassOrThrow('T').getMethodOrThrow('test')).valid).toBe(false);
    });

    it('should correctly handle missing and empty returns in ComponentPrimitive', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf1 = project.createSourceFile('test1.ts', 'export function C1() {}');
      const sf2 = project.createSourceFile('test2.ts', 'export function C2() { return; }');

      const p1 = new ComponentPrimitive({ name: 'C1', render: ts`return <div/>;` });
      p1.update(sf1.getFunctionOrThrow('C1'));
      expect(sf1.getFunctionOrThrow('C1').getBodyText()).toContain('return <div/>;');

      const p2 = new ComponentPrimitive({ name: 'C2', render: ts`return <span/>;` });
      p2.update(sf2.getFunctionOrThrow('C2'));
      expect(sf2.getFunctionOrThrow('C2').getBodyText()).toContain('return <span/>;');
    });

    it('should fallback to default cleanup for render primitive if cleanup missing', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile('test.ts', 'export function C3() { return null; }');
      const render = ts`return <main/>;`;
      delete (render as unknown as { cleanup?: unknown }).cleanup;
      const p3 = new ComponentPrimitive({ name: 'C3', render });
      p3.update(sf.getFunctionOrThrow('C3'));
      expect(sf.getFunctionOrThrow('C3').getBodyText()).toContain('return <main/>;');
    });

    it('should structurally match variables, ifs, and returns in MethodPrimitive', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile(
        'test.ts',
        'class T { test() { const x = 1; if (true) {} return; } }',
      );
      const primitive = new MethodPrimitive({
        name: 'test',
        statements: [
          {
            kind: 'variable',
            declarationKind: 'const',
            declarations: [{ name: 'x', initializer: '"2"' }],
            isDefault: false,
          },
          {
            kind: 'if',
            condition: 'true',
            then: [{ kind: 'expression', expression: 'console.log(1)' }],
            isDefault: false,
          },
          { kind: 'return', expression: '1', isDefault: false },
        ],
      });
      primitive.ensure(sf.getClassOrThrow('T'));
      const body = sf.getClassOrThrow('T').getMethodOrThrow('test').getBodyText()!;
      expect(body).toContain('const x = "2";');
      expect(body).toContain('console.log(1)');
      expect(body).toContain('return 1;');
    });
  });
});
