import { type FileDefinition, type ImportConfig, type NodeContainer } from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { ts } from '../primitives/statements/factory.js';

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
    const testBody = `
    it('should execute successfully', async () => {
        // 1. Setup prerequisite state using DataFactory
        // const prerequisite = await Factory.create('someModel', { ... });
        
        // 2. Prepare Action Input
        ${mockInputSnippet}
        
        // 3. Invoke Action directly (bypassing API Client)
        // Note: For service level tests, context is typically mocked or omitted if the action doesn't strictly depend on it.
        const ctx = {} as unknown as APIContext; 
        const result = await ${this.actionName}.run(${isVoidInput ? 'undefined' : 'input'}, ctx);
        
        // 4. Verify Database state explicitly using Prisma
        // const record = await Factory.prisma.someModel.findUnique({ where: { id: ... } });
        // expect(record).toBeDefined();
        
        // 5. Verify the Action's direct output
        expect(result.success).toBe(true);
    });
    `;

    const imports: ImportConfig[] = [
      { moduleSpecifier: 'vitest', namedImports: ['describe', 'it', 'expect'] },
      { moduleSpecifier: 'astro', namedImports: ['APIContext'], isTypeOnly: true },
      { moduleSpecifier: `@/actions/${this.actionBase}`, namedImports: [this.actionName] },
    ];

    if (this.inputType !== 'void') {
      const normalize = (t: string) => t.replace('[]', '').trim();
      const inputBase = normalize(this.inputType);

      if (!['string', 'number', 'boolean', 'unknown', 'any'].includes(inputBase.toLowerCase())) {
        imports.push({
          moduleSpecifier: '@/sdk/types',
          namedImports: [inputBase],
          isTypeOnly: true,
        });
      }
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
