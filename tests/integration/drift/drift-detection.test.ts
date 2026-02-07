import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { Reconciler } from '../../../src/engine/reconciler.js';
import { FileDefinition } from '../../../src/engine/types.js';

describe('Drift Detection', () => {
  it('should detect when a required method is missing', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
            export class UserService {
                // missing 'list' method
            }
        `,
    );

    const schema: FileDefinition = {
      classes: [
        {
          name: 'UserService',
          isExported: true,
          methods: [
            {
              name: 'list',
              returnType: 'void',
            },
          ],
        },
      ],
    };

    const result = Reconciler.validate(sourceFile, schema);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("Method 'list' is missing in UserService.");
  });

  it('should detect when a method has the wrong return type', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
            export class UserService {
                list(): string { return ""; }
            }
        `,
    );

    const schema: FileDefinition = {
      classes: [
        {
          name: 'UserService',
          methods: [
            {
              name: 'list',
              returnType: 'Promise<User[]>',
            },
          ],
        },
      ],
    };

    const result = Reconciler.validate(sourceFile, schema);
    expect(result.valid).toBe(false);
    // Note: Exact error message depends on MethodPrimitive implementation
    // We expect some issue related to return type
    expect(result.issues.some((i) => i.includes('return type mismatch'))).toBe(true);
  });

  it('should detect when a class is missing', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', ``);

    const schema: FileDefinition = {
      classes: [{ name: 'UserService' }],
    };

    const result = Reconciler.validate(sourceFile, schema);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("Class 'UserService' is missing.");
  });

  it('should NOT flag extra methods (simulating user custom code)', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
            export class UserService {
                list(): void {}
                
                // User added custom helper
                private helper(): void {}
            }
        `,
    );

    const schema: FileDefinition = {
      classes: [
        {
          name: 'UserService',
          methods: [{ name: 'list', returnType: 'void' }],
        },
      ],
    };

    const result = Reconciler.validate(sourceFile, schema);
    expect(result.valid).toBe(true);
  });
});
