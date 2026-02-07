import { describe, it, expect } from 'vitest';
import { createTestProject } from '@nexical/generator-tests/helpers/test-project';
import { Reconciler } from '../../src/engine/reconciler';

describe('Reconciler', () => {
  it('should reconcile a complete file definition', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', '');

    Reconciler.reconcile(sourceFile, {
      imports: [{ moduleSpecifier: 'react', defaultImport: 'React' }],
      classes: [
        {
          name: 'TestComponent',
          isExported: true,
          methods: [{ name: 'render', returnType: 'React.ReactNode' }],
        },
      ],
    });

    // Verify Imports
    const imports = sourceFile.getImportDeclarations();
    expect(imports).toHaveLength(1);
    expect(imports[0].getDefaultImport()?.getText()).toBe('React');

    // Verify Class
    const classDecl = sourceFile.getClass('TestComponent');
    expect(classDecl).toBeDefined();

    // Verify Method
    const method = classDecl?.getMethod('render');
    expect(method).toBeDefined();
    expect(method?.getReturnType().getText()).toBe('React.ReactNode');
  });

  it('should validate missing components', () => {
    const testProject = createTestProject();
    // Empty file
    const sourceFile = testProject.createSourceFile('test.ts', '');

    const result = Reconciler.validate(sourceFile, {
      classes: [{ name: 'MissingClass' }],
      imports: [{ moduleSpecifier: 'react', defaultImport: 'React' }],
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain("Class 'MissingClass' is missing.");
    expect(result.issues).toContain("Import 'react' is missing.");
  });

  it('should validate incorrect imports', () => {
    const testProject = createTestProject();
    const sourceFile = testProject.createSourceFile('test.ts', `import { useState } from 'react';`);

    const result = Reconciler.validate(sourceFile, {
      imports: [{ moduleSpecifier: 'react', defaultImport: 'React', namedImports: ['useEffect'] }],
    });

    expect(result.valid).toBe(false);
    // We might have multiple issues (missing default, missing named)
    expect(result.issues.some((i) => i.includes('default import mismatch'))).toBe(true);
    expect(result.issues.some((i) => i.includes('missing named imports'))).toBe(true);
  });
});
