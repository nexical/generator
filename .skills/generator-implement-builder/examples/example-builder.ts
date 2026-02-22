import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from './template-loader.js';

/**
 * Example Builder Implementation for generating an API Action.
 * Demonstrates:
 * 1. Builder Inheritance (BaseBuilder)
 * 2. Explicit Import Extensions (.js)
 * 3. Code Preservation (AST Analysis)
 * 4. Template Loading
 * 5. Dynamic Import Injection
 * 6. Action Method Signature
 * 7. Type-Only Imports
 */
export class ExampleActionBuilder extends BaseBuilder {
  static description = 'Generates an API Action';

  async build(actionName: string, inputType: string, outputType: string) {
    // 1. Load Template
    const template = await TemplateLoader.load('action/run.tsf', {
      actionName,
      inputType,
      outputType,
    });

    // 2. Analyze Existing Code (Code Preservation)
    // Assuming `this.ast` is populated by BaseBuilder on initialization
    const existingRunMethod = this.ast.getMethod('run');
    let methodBody = template.body;

    if (existingRunMethod) {
      console.info(`Preserving existing implementation of 'run' in ${actionName}`);
      methodBody = existingRunMethod.getBodyText();
    }

    // 3. Add Method with Signature
    this.addMethod({
      name: 'run',
      isStatic: true,
      isAsync: true,
      parameters: [
        { name: 'input', type: inputType },
        { name: 'context', type: 'APIContext' },
      ],
      returnType: `Promise<ServiceResponse<${outputType}>>`,
      body: methodBody,
    });

    // 4. Inject Imports (Dynamic Import Injection)
    if (methodBody.includes('OrchestrationService')) {
      this.addImport({
        moduleSpecifier: '@/lib/orchestration',
        namedImports: ['OrchestrationService'],
      });
    }

    // 5. Type-Only Imports
    this.addImport({
      moduleSpecifier: 'astro',
      namedImports: ['APIContext'],
      isTypeOnly: true,
    });

    // 6. Write Output
    await this.write();
  }
}
