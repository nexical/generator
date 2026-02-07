import { Project, Statement, ReturnStatement, Block } from 'ts-morph';
import { type ParsedStatement } from '../../types.js';

export function tsx(strings: TemplateStringsArray, ...values: unknown[]): ParsedStatement {
  const raw = strings.reduce((acc, str, i) => {
    return acc + str + (values[i] !== undefined ? values[i] : '');
  }, '');

  let tempFile: import('ts-morph').SourceFile | undefined;
  return {
    raw,
    getNodes(project: Project): Statement[] {
      // Wrap in a temporary function to validate JSX and extract the return statement
      const wrapped = `function _render() { return (${raw}); }`;
      const fileName = `__temp_fragment_tsx_${Date.now()}_${Math.random().toString(36).substring(7)}.tsx`;

      // We must use .tsx extension for JSX parsing
      tempFile = project.createSourceFile(fileName, wrapped, { overwrite: true });

      const func = tempFile.getFunction('_render');
      if (!func) {
        throw new Error('Failed to parse JSX fragment: could not find wrapper function');
      }

      const body = func.getBody() as Block;
      if (!body) {
        throw new Error('Failed to parse JSX fragment: function has no body');
      }

      const returnStmt = body
        .getStatements()
        .find((s: Statement) => s.getKindName() === 'ReturnStatement') as
        | ReturnStatement
        | undefined;

      if (!returnStmt) {
        throw new Error(
          'Failed to parse JSX fragment: no return statement found. Ensure your fragment is a valid JSX expression.',
        );
      }

      // We return the ReturnStatement.
      return [returnStmt];
    },
    cleanup() {
      if (tempFile) {
        try {
          tempFile.delete();
        } catch {
          // Ignore if already deleted
        }
        tempFile = undefined;
      }
    },
  };
}
