/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ComponentPrimitive } from '../../../src/engine/primitives/nodes/component.js';
import { tsx } from '../../../src/engine/primitives/jsx/factory.js';

describe('ComponentPrimitive', () => {
  it('should create a new component from scratch', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.tsx', '');

    const render = tsx`
      <div className="card">
        <h1>{title}</h1>
      </div>
    `;

    const primitive = new ComponentPrimitive({
      name: 'Card',
      isExported: true,
      props: [{ name: 'title', type: 'string' }],
      render,
    });

    primitive.ensure(sourceFile);

    const text = sourceFile.getText();
    expect(text).toContain('export const Card = ({ title }: { title: string }) => {');
    expect(text).toContain('<div className="card">');
    expect(text).toContain('<h1>{title}</h1>');
  });

  it('should reconcile an existing component body', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    // Simulate existing component with old content
    const sourceFile = project.createSourceFile(
      'test.tsx',
      `
      export const Card = ({ title }: { title: string }) => {
        return <div>Old Content</div>;
      }
    `,
    );

    const render = tsx`
      <div className="new-card">
        <h1>{title}</h1>
      </div>
    `;

    const primitive = new ComponentPrimitive({
      name: 'Card',
      isExported: true,
      props: [{ name: 'title', type: 'string' }],
      render,
    });

    primitive.ensure(sourceFile);

    const text = sourceFile.getText();
    expect(text).toContain('className="new-card"');
    expect(text).not.toContain('Old Content');
  });

  it('should not overwrite custom logic in the body', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    // Simulate component with hooks
    const sourceFile = project.createSourceFile(
      'test.tsx',
      `
      export const Counter = () => {
        const [count, setCount] = useState(0);
        return <div>{count}</div>;
      }
    `,
    );

    const render = tsx`
      <button onClick={() => setCount(count + 1)}>
        Count is {count}
      </button>
    `;

    const primitive = new ComponentPrimitive({
      name: 'Counter',
      render,
    });

    primitive.ensure(sourceFile);

    const text = sourceFile.getText();
    expect(text).toContain('const [count, setCount] = useState(0);'); // Should be preserved
    expect(text).toContain('<button onClick='); // New return
  });
});
