/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph';
import { VariablePrimitive } from '@nexical/generator/engine/primitives/nodes/variable.js';

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
    expect(result.issues.some((i: string) => i.includes('initializer mismatch'))).toBe(true);
  });

  it('should create a variable with comments', () => {
    const primitive = new VariablePrimitive({
      name: 'COMMENTED',
      comments: ['Line 1', 'Line 2'],
    });
    primitive.create(sourceFile);
    const text = sourceFile.getFullText(); // Use getFullText to see leading trivia
    expect(text).toContain('// Line 1');
    expect(text).toContain('// Line 2');
    expect(text).toContain('const COMMENTED');
  });

  it('should update export status and declaration kind', () => {
    sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      isExported: false,
      declarations: [{ name: 'VAR_TO_UPDATE', initializer: '1' }],
    });
    const stmt = sourceFile.getVariableStatement('VAR_TO_UPDATE')!;

    const primitive = new VariablePrimitive({
      name: 'VAR_TO_UPDATE',
      isExported: true,
      declarationKind: 'let',
    });

    primitive.update(stmt);
    expect(stmt.isExported()).toBe(true);
    expect(stmt.getDeclarationKind()).toBe(VariableDeclarationKind.Let);
  });

  it('should update comments', () => {
    sourceFile.addVariableStatement({
      declarations: [{ name: 'COMMENT_VAR', initializer: '1' }],
    });
    const stmt = sourceFile.getVariableStatement('COMMENT_VAR')!;

    const primitive = new VariablePrimitive({
      name: 'COMMENT_VAR',
      comments: ['Updated Comment'],
    });

    primitive.update(stmt);
    expect(sourceFile.getFullText()).toContain('// Updated Comment');
  });

  it('should handle raw initializer config', () => {
    const primitive = new VariablePrimitive({
      name: 'RAW',
      initializer: { raw: 'new Date()' },
    });
    primitive.create(sourceFile);
    const decl = sourceFile.getVariableDeclaration('RAW');
    expect(decl?.getInitializer()?.getText()).toBe('new Date()');
  });

  it('should handle let and var declaration kinds', () => {
    const primVar = new VariablePrimitive({
      name: 'MY_VAR',
      declarationKind: 'var',
    });
    expect(primVar.create(sourceFile).getDeclarationKind()).toBe(VariableDeclarationKind.Var);

    const primLet = new VariablePrimitive({
      name: 'MY_LET',
      declarationKind: 'let',
    });
    expect(primLet.create(sourceFile).getDeclarationKind()).toBe(VariableDeclarationKind.Let);
  });

  it('should validate export mismatch', () => {
    sourceFile.addVariableStatement({
      isExported: false,
      declarations: [{ name: 'V', initializer: '1' }],
    });
    const stmt = sourceFile.getVariableStatement('V')!;
    const primitive = new VariablePrimitive({
      name: 'V',
      isExported: true,
    });
    const result = primitive.validate(stmt);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('export mismatch');
  });

  it('should validate when declaration is not found in statement', () => {
    sourceFile.addVariableStatement({
      declarations: [{ name: 'OTHER' }],
    });
    const stmt = sourceFile.getVariableStatement('OTHER')!;
    const primitive = new VariablePrimitive({ name: 'NOT_THERE' });
    const result = primitive.validate(stmt);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('not found within statement');
  });

  it('should return early in update if declaration not found', () => {
    sourceFile.addVariableStatement({
      declarations: [{ name: 'OTHER' }],
    });
    const stmt = sourceFile.getVariableStatement('OTHER')!;
    const primitive = new VariablePrimitive({ name: 'NOT_THERE' });
    // This should just return early (Line 43)
    primitive.update(stmt);
  });

  it('should not update if initializer already matches', () => {
    sourceFile.addVariableStatement({
      declarations: [{ name: 'MATCH_INIT', initializer: '10' }],
    });
    const stmt = sourceFile.getVariableStatement('MATCH_INIT')!;
    const primitive = new VariablePrimitive({
      name: 'MATCH_INIT',
      initializer: '10',
    });
    const setInitSpy = vi.spyOn(stmt.getDeclarations()[0], 'setInitializer');
    primitive.update(stmt);
    expect(setInitSpy).not.toHaveBeenCalled();
  });

  it('should update if current initializer is missing but new one is provided', () => {
    sourceFile.addVariableStatement({
      declarations: [{ name: 'NO_INIT' }],
    });
    const stmt = sourceFile.getVariableStatement('NO_INIT')!;
    const primitive = new VariablePrimitive({
      name: 'NO_INIT',
      initializer: '20',
    });
    primitive.update(stmt);
    expect(stmt.getDeclarations()[0].getInitializer()?.getText()).toBe('20');
  });

  it('should not update comments if they already match', () => {
    const primitive = new VariablePrimitive({
      name: 'PRE_COMMENTED',
      comments: ['Existing'],
    });
    const stmt = primitive.create(sourceFile);
    const replaceSpy = vi.spyOn(stmt, 'replaceWithText');
    primitive.update(stmt);
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('should not update export status if it already matches', () => {
    sourceFile.addVariableStatement({
      isExported: true,
      declarations: [{ name: 'MATCH_EXPORT' }],
    });
    const stmt = sourceFile.getVariableStatement('MATCH_EXPORT')!;
    const primitive = new VariablePrimitive({
      name: 'MATCH_EXPORT',
      isExported: true,
    });
    const setExportSpy = vi.spyOn(stmt, 'setIsExported');
    primitive.update(stmt);
    expect(setExportSpy).not.toHaveBeenCalled();
  });
});
