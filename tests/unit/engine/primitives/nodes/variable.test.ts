/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph';
import { VariablePrimitive } from '@nexical/generator/engine/primitives/nodes/variable';

describe('VariablePrimitive', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
  });

  it('should create a new variable', () => {
    const primitive = new VariablePrimitive({
      name: 'API_URL',
      type: 'string',
      initializer: '"https://api.example.com"',
      declarationKind: 'const',
      isExported: true,
    });

    primitive.ensure(sourceFile);

    const variable = sourceFile.getVariableStatement('API_URL');
    expect(variable).toBeDefined();
    expect(variable?.isExported()).toBe(true);
    expect(variable?.getDeclarationKind()).toBe(VariableDeclarationKind.Const);

    const decl = variable?.getDeclarations()[0];
    expect(decl?.getName()).toBe('API_URL');
    expect(decl?.getType().getText()).toBe('string');
    expect(decl?.getInitializer()?.getText()).toBe('"https://api.example.com"');
  });

  it('should update an existing variable (initializer & type)', () => {
    sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      isExported: true,
      declarations: [
        {
          name: 'MAX_RETRIES',
          type: 'number',
          initializer: '3',
        },
      ],
    });

    const primitive = new VariablePrimitive({
      name: 'MAX_RETRIES',
      type: 'string', // Update type
      initializer: '"5"', // Update initializer
      declarationKind: 'const',
    });

    primitive.ensure(sourceFile);

    const variable = sourceFile.getVariableStatement('MAX_RETRIES');
    const decl = variable?.getDeclarations()[0];
    expect(decl?.getInitializer()?.getText()).toBe('"5"');
    expect(decl?.getType().getText()).toBe('string');
  });

  it('should validate correctly', () => {
    sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: 'MAX', initializer: '10' }],
    });
    const varNode = sourceFile.getVariableStatement('MAX')!;

    const primitive = new VariablePrimitive({
      name: 'MAX',
      initializer: '20', // Mismatch
    });

    const result = primitive.validate(varNode);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('initializer mismatch'))).toBe(true);
  });
});
