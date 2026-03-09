import { type FileDefinition, type ImportConfig, type NodeContainer } from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { ts } from '../primitives/statements/factory.js';
import { TemplateLoader } from '../../utils/template-loader.js';

export class ServiceTestBuilder extends BaseBuilder {
  constructor(
    private actionBase: string,
    private actionName: string,
    private inputType: string,
    private outputType: string,
  ) {
    super();
  }

  protected getSchema(_node?: NodeContainer): FileDefinition {
    const isVoidInput = this.inputType === 'void';

    const mockInputSnippet = isVoidInput
      ? ''
      : `const input: ${this.inputType} = {} as unknown as ${this.inputType}; // TODO: Provide valid mock data`;

    // Using DataFactory directly since this is a database-centric integration test
    const testBody = TemplateLoader.load('test/service-integration.tsf', {
      testBody: mockInputSnippet,
      actionName: this.actionName,
      inputArgument: isVoidInput ? 'undefined' : 'input',
    }).raw;

    const imports: ImportConfig[] = [
      { moduleSpecifier: 'vitest', namedImports: ['describe', 'it', 'expect'] },
      {
        moduleSpecifier: '../../../../../tests/integration/helpers/context',
        namedImports: ['createMockContext'],
      },
      {
        moduleSpecifier: `../../../src/actions/${this.actionBase}`,
        namedImports: [this.actionName],
      },
    ];

    const typesToImport = new Set<string>();
    const normalize = (t: string) =>
      t.replace('[]', '').replace('Array<', '').replace('>', '').trim();

    // Only import the input type — the output/response DTO is never referenced in the
    // generated test body (only in the skipped boilerplate), so importing it would be unused.
    if (this.inputType !== 'void') {
      const inputBase = normalize(this.inputType);
      if (!['string', 'number', 'boolean', 'unknown', 'any'].includes(inputBase.toLowerCase())) {
        typesToImport.add(inputBase);
      }
    }

    if (typesToImport.size > 0) {
      imports.push({
        moduleSpecifier: '../../../src/sdk',
        namedImports: Array.from(typesToImport),
        isTypeOnly: true,
      });
    }

    return {
      header:
        '// INITIAL GENERATED CODE - REVIEW AND MODIFY AS NEEDED FOR SERVICE INTEGRATION TESTS',
      imports,
      variables: [],
      statements: [
        ts`describe('${this.actionName} - Service Integration', () => {
    ${testBody}
})`,
      ],
    };
  }
}
