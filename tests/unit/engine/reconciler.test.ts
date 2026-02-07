/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { Reconciler } from '../../../src/engine/reconciler.js';
import type { FileDefinition, PropertyConfig } from '../../../src/engine/types.js';
import { Normalizer } from '../../../src/utils/normalizer.js';

describe('Reconciler', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('test.ts', '');
  });

  it('should reconcile header', () => {
    const definition: FileDefinition = {
      header: '// Custom Header\n',
    };

    Reconciler.reconcile(sourceFile, definition);
    expect(sourceFile.getFullText()).toContain('// Custom Header');
  });

  it('should reconcile imports', () => {
    const definition: FileDefinition = {
      imports: [{ moduleSpecifier: './foo', namedImports: ['Bar'] }],
    };

    Reconciler.reconcile(sourceFile, definition);
    expect(sourceFile.getImportDeclaration('./foo')).toBeDefined();
  });

  it('should reconcile classes with properties and methods', () => {
    const definition: FileDefinition = {
      classes: [
        {
          name: 'TestClass',
          properties: [{ name: 'prop', type: 'string' }],
          methods: [{ name: 'method', statements: [{ kind: 'return', expression: '"hello"' }] }],
        },
      ],
    };

    Reconciler.reconcile(sourceFile, definition);
    const classNode = sourceFile.getClass('TestClass');
    expect(classNode).toBeDefined();
    expect(classNode?.getProperty('prop')).toBeDefined();
    expect(classNode?.getMethod('method')).toBeDefined();
  });

  it('should reconcile interfaces, enums, and functions', () => {
    const definition: FileDefinition = {
      interfaces: [{ name: 'ITest' }],
      enums: [
        {
          name: 'TestEnum',
          members: [
            { name: 'A', value: 1 },
            { name: 'B', value: 2 },
          ],
        },
      ],
      functions: [{ name: 'testFunc' }],
    };

    Reconciler.reconcile(sourceFile, definition);
    expect(sourceFile.getInterface('ITest')).toBeDefined();
    expect(sourceFile.getEnum('TestEnum')).toBeDefined();
    expect(sourceFile.getFunction('testFunc')).toBeDefined();
  });

  it('should validate modules and types', () => {
    const definition: FileDefinition = {
      modules: [{ name: 'M' }],
      types: [{ name: 'T', type: 'string' }],
    };
    const res1 = Reconciler.validate(sourceFile, definition);
    expect(res1.valid).toBe(false);
    expect(res1.issues).toContain("Module 'M' is missing.");
    expect(res1.issues).toContain("Type 'T' is missing.");
  });

  it('should validate variables', () => {
    const definition: FileDefinition = {
      variables: [{ name: 'V', type: 'string', initializer: "'v'" }],
    };
    const res = Reconciler.validate(sourceFile, definition);
    expect(res.valid).toBe(false);
    expect(res.issues).toContain("Variable 'V' is missing.");
  });

  it('should reconcile modules and types', () => {
    const definition: FileDefinition = {
      modules: [{ name: 'TestModule' }],
      types: [{ name: 'TestType', type: 'string' }],
    };

    Reconciler.reconcile(sourceFile, definition);
    expect(sourceFile.getModule('TestModule')).toBeDefined();
    expect(sourceFile.getTypeAlias('TestType')).toBeDefined();
  });

  it('should reconcile raw statements', () => {
    const definition: FileDefinition = {
      statements: ['console.log("hello");'],
    };

    Reconciler.reconcile(sourceFile, definition);
    expect(sourceFile.getFullText()).toContain('console.log("hello");');
  });

  it('should validate correctly', () => {
    const definition: FileDefinition = {
      classes: [{ name: 'TestClass' }],
    };

    // Initially invalid
    let result = Reconciler.validate(sourceFile, definition);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("Class 'TestClass' is missing.");

    // Reconcile and validate
    Reconciler.reconcile(sourceFile, definition);
    result = Reconciler.validate(sourceFile, definition);
    expect(result.valid).toBe(true);
  });

  it('should handle errors in reconcile', () => {
    const definition: FileDefinition = {
      classes: [{ name: 'TestClass', properties: [null as unknown as PropertyConfig] }],
    };

    expect(() => Reconciler.reconcile(sourceFile, definition)).toThrow(/Failed to reconcile file/);
  });

  it('should identify missing interfaces, enums, etc. in validate', () => {
    const definition: FileDefinition = {
      interfaces: [{ name: 'IMissing' }],
      enums: [{ name: 'EnumMissing', members: [] }],
      functions: [{ name: 'funcMissing' }],
      types: [{ name: 'TypeMissing', type: 'string' }],
      variables: [{ name: 'varMissing' }],
      modules: [{ name: 'ModMissing' }],
    };

    const result = Reconciler.validate(sourceFile, definition);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("Interface 'IMissing' is missing.");
    expect(result.issues).toContain("Enum 'EnumMissing' is missing.");
    expect(result.issues).toContain("Function 'funcMissing' is missing.");
    expect(result.issues).toContain("Type 'TypeMissing' is missing.");
    expect(result.issues).toContain("Variable 'varMissing' is missing.");
    expect(result.issues).toContain("Module 'ModMissing' is missing.");
  });

  it('should identify missing class members in validate', () => {
    const definition: FileDefinition = {
      classes: [
        {
          name: 'TestClass',
          properties: [{ name: 'missingProp', type: 'string' }],
          constructorDef: { parameters: [] },
          accessors: [{ name: 'missingAcc', kind: 'get' }],
          methods: [{ name: 'missingMethod' }],
        },
      ],
    };

    sourceFile.addClass({ name: 'TestClass' });
    const result = Reconciler.validate(sourceFile, definition);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("Property 'missingProp' is missing in TestClass.");
    expect(result.issues).toContain('Constructor is missing in TestClass.');
    expect(result.issues).toContain("Accessor 'missingAcc' is missing in TestClass.");
    expect(result.issues).toContain("Method 'missingMethod' is missing in TestClass.");
  });

  it('should not prune imports with canonical variations (normalized matching)', () => {
    // 1. Setup file with a "canonical" import
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@modules/user-api/src/sdk',
      namedImports: ['UserDTO'],
    });

    // Add generated marker to enable pruning
    sourceFile.insertStatements(0, '// GENERATED CODE - DO NOT MODIFY\n');

    // 2. Define expected import with variations
    const definition: FileDefinition = {
      imports: [
        {
          moduleSpecifier: '@modules/user-api/src/sdk/index', // Variation 1: /index
          namedImports: ['UserDTO'],
        },
      ],
    };

    // 3. Reconcile
    Reconciler.reconcile(sourceFile, definition);

    // 4. Verify import is STILL there (not pruned)
    const imports = sourceFile.getImportDeclarations();
    expect(imports.length).toBe(1);
    expect(Normalizer.normalizeImport(imports[0].getModuleSpecifierValue())).toBe(
      '@modules/user-api/src/sdk',
    );
  });

  it('should not prune imports with legacy mappings', () => {
    // 1. Setup file with new path
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@/lib/api/api-guard',
      namedImports: ['ApiGuard'],
    });
    sourceFile.insertStatements(0, '// GENERATED CODE - DO NOT MODIFY\n');

    // 2. Definition uses legacy path
    const definition: FileDefinition = {
      imports: [
        {
          moduleSpecifier: '@/lib/api-guard',
          namedImports: ['ApiGuard'],
        },
      ],
    };

    // 3. Reconcile
    Reconciler.reconcile(sourceFile, definition);

    // 4. Verify import is preserved
    expect(
      sourceFile.getImportDeclaration((d) => d.getModuleSpecifierValue() === '@/lib/api/api-guard'),
    ).toBeDefined();
  });

  it('should not duplicate multiline raw statements (e.g. enums)', () => {
    const enumStmt = `export enum TestEnum {
    A = 'A',
    B = 'B'
}`;
    const definition: FileDefinition = {
      statements: [enumStmt],
    };

    // 1. Initial reconcile
    Reconciler.reconcile(sourceFile, definition);
    expect(sourceFile.getFullText()).toContain('export enum TestEnum');
    const firstCount = sourceFile.getFullText().split('export enum TestEnum').length - 1;
    expect(firstCount).toBe(1);

    // 2. Second reconcile with slightly different spacing
    const definition2: FileDefinition = {
      statements: [`export enum TestEnum {\n    A = 'A',\n    B = 'B'\n}`],
    };
    Reconciler.reconcile(sourceFile, definition2);
    const secondCount = sourceFile.getFullText().split('export enum TestEnum').length - 1;
    expect(secondCount).toBe(1); // Should still be 1
  });
});
