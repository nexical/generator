/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
import { Project } from 'ts-morph';
import { tsx } from '../../../../../src/engine/primitives/jsx/factory.js';

describe('tsx factory', () => {
  it('should handle template string with values', () => {
    const val = 'Hello';
    const fragment = tsx`<div>${val}</div>`;
    expect(fragment.raw).toBe('<div>Hello</div>');
  });

  it('should handle undefined values by empty string', () => {
    const fragment = tsx`<div>${undefined}</div>`;
    expect(fragment.raw).toBe('<div></div>');
  });

  it('should extract return statement nodes', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const fragment = tsx`<div className="foo">Test</div>`;
    const nodes = fragment.getNodes(project);
    expect(nodes.length).toBe(1);
    expect(nodes[0].getKindName()).toBe('ReturnStatement');
    expect(nodes[0].getText()).toBe('return (<div className="foo">Test</div>);');

    fragment.cleanup?.();
  });

  it('should throw error if return statement is missing', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    // This is valid TS but doesn't result in a single return statement of JSX if matched poorly
    // However, the wrapper is: function _render() { return (${raw}); }
    // So if raw is empty it might fail.
    const fragment = tsx``;
    expect(() => fragment.getNodes(project)).toThrow('no return statement found');
  });

  it('should handle cleanup', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const fragment = tsx`<div></div>`;
    fragment.getNodes(project);

    // We can't easily check if file is deleted without internal access,
    // but we can call it to cover branches.
    fragment.cleanup?.();
    fragment.cleanup?.(); // Second call for coverage of "if (tempFile)" check
  });

  it('should throw if wrapper function is not found', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    vi.spyOn(project, 'createSourceFile').mockReturnValue({
      getFunction: () => undefined,
      delete: () => {},
    } as unknown as import('ts-morph').SourceFile);
    const fragment = tsx`<div></div>`;
    expect(() => fragment.getNodes(project)).toThrow('could not find wrapper function');
  });

  it('should throw if function has no body', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    vi.spyOn(project, 'createSourceFile').mockReturnValue({
      getFunction: () => ({
        getBody: () => undefined,
      }),
      delete: () => {},
    } as unknown as import('ts-morph').SourceFile);
    const fragment = tsx`<div></div>`;
    expect(() => fragment.getNodes(project)).toThrow('function has no body');
  });

  it('should throw if return statement is missing inside body', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    vi.spyOn(project, 'createSourceFile').mockReturnValue({
      getFunction: () => ({
        getBody: () => ({
          getStatements: () => [],
        }),
      }),
      delete: () => {},
    } as unknown as import('ts-morph').SourceFile);
    const fragment = tsx`<div></div>`;
    expect(() => fragment.getNodes(project)).toThrow(
      'no return statement found. Ensure your fragment is a valid JSX expression.',
    );
  });
});
