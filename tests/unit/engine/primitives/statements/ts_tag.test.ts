/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ts } from '../../../../../src/engine/primitives/statements/factory.js';

describe('ts Tagged Template', () => {
  it('should parse simple statements', () => {
    const fragment = ts`const x = 1; return x;`;
    expect(fragment.raw).toBe('const x = 1; return x;');

    const project = new Project({ useInMemoryFileSystem: true });
    const nodes = fragment.getNodes(project);

    expect(nodes).toHaveLength(2);
    expect(nodes[0].getKindName()).toBe('VariableStatement');
    expect(nodes[1].getKindName()).toBe('ReturnStatement');
  });

  it('should handle interpolation', () => {
    const value = 10;
    const fragment = ts`const x = ${value};`;
    expect(fragment.raw).toBe('const x = 10;');

    const project = new Project({ useInMemoryFileSystem: true });
    const nodes = fragment.getNodes(project);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].getText()).toBe('const x = 10;');
  });
});
