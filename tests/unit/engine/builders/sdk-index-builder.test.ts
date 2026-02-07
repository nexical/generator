/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { SdkIndexBuilder } from '../../../../src/engine/builders/sdk-index-builder.js';
import { Project } from 'ts-morph';

describe('SdkIndexBuilder', () => {
  const project = new Project();

  it('should strip "-api" suffix and PascalCase the name', () => {
    const builder = new SdkIndexBuilder([], 'user-api');
    project.createSourceFile('test.ts', '', { overwrite: true });

    // @ts-expect-error - accessing protected method for testing
    const schema = builder.getSchema();
    expect(schema.classes![0].name).toBe('UserModule');
  });

  it('should preserve full name if no "-api" suffix and PascalCase it', () => {
    const builder = new SdkIndexBuilder([], 'user-test');
    project.createSourceFile('test.ts', '', { overwrite: true });

    // @ts-expect-error - accessing protected method for testing
    const schema = builder.getSchema();
    expect(schema.classes![0].name).toBe('UserTestModule');
  });

  it('should handle multiple hyphens correctly', () => {
    const builder = new SdkIndexBuilder([], 'my-custom-module');
    project.createSourceFile('test.ts', '', { overwrite: true });

    // @ts-expect-error - accessing protected method for testing
    const schema = builder.getSchema();
    expect(schema.classes![0].name).toBe('MyCustomModuleModule');
  });
});
