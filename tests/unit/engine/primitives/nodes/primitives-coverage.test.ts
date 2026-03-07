/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { InterfacePrimitive } from '../../../../../src/engine/primitives/nodes/interface.js';
import { VariablePrimitive } from '../../../../../src/engine/primitives/nodes/variable.js';
import { AccessorPrimitive } from '../../../../../src/engine/primitives/nodes/accessor.js';
import { Project } from 'ts-morph';
import type { VariableConfig, StatementConfig } from '../../../../../src/engine/types.js';

describe('InterfacePrimitive', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
  });

  it('should create an interface with properties', () => {
    const file = project.createSourceFile('test.ts', '');
    const primitive = new InterfacePrimitive({
      name: 'User',
      isExported: true,
      properties: [
        { name: 'id', type: 'string' },
        { name: 'email', type: 'string', optional: true },
      ],
    });

    const iface = primitive.create(file);
    expect(iface.getName()).toBe('User');
    expect(iface.getProperties().length).toBe(2);
    expect(iface.getProperty('email')?.hasQuestionToken()).toBe(true);
  });

  it('should create an interface with extends', () => {
    const file = project.createSourceFile('test_ext.ts', '');
    const primitive = new InterfacePrimitive({
      name: 'Admin',
      extends: ['User'],
    });

    const iface = primitive.create(file);
    expect(iface.getExtends().map((e) => e.getText())).toContain('User');
  });

  it('should update interface properties and add new ones', () => {
    const file = project.createSourceFile('test_upd.ts', 'interface Foo { name: string; }');
    const iface = file.getInterface('Foo')!;

    const primitive = new InterfacePrimitive({
      name: 'Foo',
      properties: [
        { name: 'name', type: 'number' }, // type change
        { name: 'age', type: 'string' }, // new prop
      ],
    });

    primitive.update(iface);
    expect(iface.getProperties().map((p) => p.getName())).toContain('age');
  });

  it('should update extends on interface', () => {
    const file = project.createSourceFile('test_ext_upd.ts', 'interface Foo extends Bar {}');
    const iface = file.getInterface('Foo')!;

    const primitive = new InterfacePrimitive({
      name: 'Foo',
      extends: ['Baz'],
    });

    primitive.update(iface);
    expect(iface.getExtends().map((e) => e.getText())).toContain('Baz');
  });

  it('should validate correct interface', () => {
    const file = project.createSourceFile('test_val.ts', 'interface Foo { name: string; }');
    const iface = file.getInterface('Foo')!;

    const primitive = new InterfacePrimitive({
      name: 'Foo',
      properties: [{ name: 'name', type: 'string' }],
    });

    const result = primitive.validate(iface);
    expect(result.valid).toBe(true);
  });

  it('should report issues for missing property', () => {
    const file = project.createSourceFile('test_miss.ts', 'interface Foo {}');
    const iface = file.getInterface('Foo')!;

    const primitive = new InterfacePrimitive({
      name: 'Foo',
      properties: [{ name: 'missing', type: 'string' }],
    });

    const result = primitive.validate(iface);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('missing');
  });

  it('should report issues for type mismatch', () => {
    const file = project.createSourceFile('test_type.ts', 'interface Foo { count: number; }');
    const iface = file.getInterface('Foo')!;

    const primitive = new InterfacePrimitive({
      name: 'Foo',
      properties: [{ name: 'count', type: 'string' }], // expect string, have number
    });

    const result = primitive.validate(iface);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('type mismatch');
  });
});

describe('VariablePrimitive', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
  });

  it('should create a const variable', () => {
    const file = project.createSourceFile('test.ts', '');
    const primitive = new VariablePrimitive({
      name: 'config',
      declarationKind: 'const',
      isExported: true,
      initializer: '{}',
    });

    primitive.create(file);
    expect(file.getVariableDeclaration('config')).toBeDefined();
  });

  it('should handle raw initializer object', () => {
    const file = project.createSourceFile('test_raw.ts', '');
    const primitive = new VariablePrimitive({
      name: 'raw',
      declarationKind: 'const',
      initializer: { raw: '{ key: "value" }' },
    } as unknown as VariableConfig);

    primitive.create(file);
    expect(file.getFullText()).toContain('key: "value"');
  });

  it('should update variable initializer', () => {
    const file = project.createSourceFile('test_upd.ts', 'const x = "old";');
    const stmt = file.getVariableStatementOrThrow('x');

    const primitive = new VariablePrimitive({
      name: 'x',
      declarationKind: 'const',
      initializer: '"new"',
    });

    primitive.update(stmt);
    expect(file.getVariableDeclaration('x')?.getInitializer()?.getText()).toBe('"new"');
  });

  it('should update variable export status', () => {
    const file = project.createSourceFile('test_exp.ts', 'const myVal = "hello";');
    const stmt = file.getVariableStatementOrThrow('myVal');

    const primitive = new VariablePrimitive({
      name: 'myVal',
      declarationKind: 'const',
      isExported: true,
    });

    primitive.update(stmt);
    expect(stmt.isExported()).toBe(true);
  });

  it('should validate correct variable', () => {
    const file = project.createSourceFile('test_val.ts', 'export const myVal = "hello";');
    const stmt = file.getVariableStatementOrThrow('myVal');

    const primitive = new VariablePrimitive({
      name: 'myVal',
      declarationKind: 'const',
      isExported: true,
      initializer: '"hello"',
    });

    const result = primitive.validate(stmt);
    expect(result.valid).toBe(true);
  });

  it('should report issues for wrong initializer', () => {
    const file = project.createSourceFile('test_fail.ts', 'const x = "old";');
    const stmt = file.getVariableStatementOrThrow('x');

    const primitive = new VariablePrimitive({
      name: 'x',
      declarationKind: 'const',
      initializer: '"expected"',
    });

    const result = primitive.validate(stmt);
    expect(result.valid).toBe(false);
  });
});

describe('AccessorPrimitive', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
  });

  it('should create a getter accessor', () => {
    const file = project.createSourceFile('test.ts', 'class Foo {}');
    const cls = file.getClass('Foo')!;

    const primitive = new AccessorPrimitive({
      name: 'value',
      kind: 'get',
      returnType: 'string',
      statements: [{ kind: 'return', expression: 'this._value' }] as unknown as StatementConfig[],
    });

    primitive.create(cls);
    expect(cls.getGetAccessor('value')).toBeDefined();
  });

  it('should update getter body', () => {
    const file = project.createSourceFile(
      'test_upd.ts',
      'class Foo { get val() { return "old"; } }',
    );
    const cls = file.getClass('Foo')!;
    const getter = cls.getGetAccessor('val')!;

    const primitive = new AccessorPrimitive({
      name: 'val',
      kind: 'get',
      statements: [{ kind: 'return', expression: '"new"' }] as unknown as StatementConfig[],
    });

    primitive.update(getter);
    expect(cls.getGetAccessor('val')?.getBodyText()?.trim()).toContain('"new"');
  });

  it('should validate getter type', () => {
    const file = project.createSourceFile(
      'test_val.ts',
      'class Foo { get name(): string { return ""; } }',
    );
    const cls = file.getClass('Foo')!;
    const getter = cls.getGetAccessor('name')!;

    const primitive = new AccessorPrimitive({
      name: 'name',
      kind: 'get',
      returnType: 'string',
    });

    const result = primitive.validate(getter);
    expect(result.valid).toBe(true);
  });

  it('should report kind mismatch on validate', () => {
    const file = project.createSourceFile(
      'test_kind.ts',
      'class Foo { get val(): string { return ""; } }',
    );
    const cls = file.getClass('Foo')!;
    const getter = cls.getGetAccessor('val')!;

    const primitive = new AccessorPrimitive({
      name: 'val',
      kind: 'set',
    });

    const result = primitive.validate(getter);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('kind mismatch');
  });
});
