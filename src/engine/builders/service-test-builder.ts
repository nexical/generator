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
      : `const input: ${this.inputType} = {} as any; // TODO: Provide valid mock data`;

    // Using DataFactory directly since this is a database-centric integration test
    const testBody = `
    it('should execute successfully', async () => {
        // 1. Setup prerequisite state using DataFactory
        // const prerequisite = await Factory.create('someModel', { ... });
        
        // 2. Prepare Action Input
        ${mockInputSnippet}
        
        // 3. Invoke Action directly (bypassing API Client)
        // Note: For service level tests, context is typically mocked or omitted if the action doesn't strictly depend on it.
        const ctx = {} as any; 
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
      { moduleSpecifier: '@tests/integration/lib/factory', namedImports: ['Factory'] },
      { moduleSpecifier: `@/actions/${this.actionBase}`, namedImports: [this.actionName] },
    ];

    if (this.inputType !== 'void' || this.outputType !== 'void') {
      const typesToImport = [];
      const normalize = (t: string) => t.replace('[]', '').trim();
      const inputBase = normalize(this.inputType);
      const outputBase = normalize(this.outputType);

      if (
        this.inputType !== 'void' &&
        !['string', 'number', 'boolean', 'unknown', 'any'].includes(inputBase.toLowerCase())
      ) {
        typesToImport.push(inputBase);
      }
      if (
        this.outputType !== 'void' &&
        !typesToImport.includes(outputBase) &&
        !['string', 'number', 'boolean', 'unknown', 'any'].includes(outputBase.toLowerCase())
      ) {
        typesToImport.push(outputBase);
      }

      if (typesToImport.length > 0) {
        imports.push({
          moduleSpecifier: '@/sdk/types',
          namedImports: typesToImport,
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
