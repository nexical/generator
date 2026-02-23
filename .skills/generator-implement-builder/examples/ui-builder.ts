import { type Project, type SourceFile } from 'ts-morph';
import { UiBaseBuilder } from './ui-base-builder.js';
import { type FileDefinition, type ModuleConfig } from '../../types.js';
import { Reconciler } from '../../reconciler.js';
import { toPascalCase } from '../../../utils/string.js';

/**
 * Example of a UI Builder that generates multiple files using manual reconciliation.
 * This pattern is used when the standard getSchema() (one file per builder) is insufficient.
 */
export class ExampleUiBuilder extends UiBaseBuilder {
  constructor(
    protected moduleName: string,
    protected config: ModuleConfig,
    protected modulePath: string,
  ) {
    super(moduleName, config, modulePath);
  }

  public override async build(
    project: Project,
    _sourceFile: SourceFile | undefined,
  ): Promise<void> {
    const models = this.resolveModels();

    for (const model of models) {
      // 1. Determine target file path
      const componentName = `${toPascalCase(model.name)}View`;
      const fileName = `${this.modulePath}/src/components/${componentName}.tsx`;

      // 2. Load or create the SourceFile
      const file = project.createSourceFile(fileName, '', { overwrite: true });

      // 3. Define the declarative schema
      const definition: FileDefinition = {
        header: '// GENERATED CODE - DO NOT MODIFY',
        imports: [
          { moduleSpecifier: 'react', namedImports: ['React'] },
          { moduleSpecifier: '@/components/ui/card', namedImports: ['Card'] },
        ],
        functions: [
          {
            name: componentName,
            isExported: true,
            statements: [
              {
                kind: 'return',
                expression: {
                  kind: 'jsx',
                  tagName: 'Card',
                  children: [
                    {
                      kind: 'jsx',
                      tagName: 'h1',
                      children: [{ kind: 'expression', expression: `"${model.name} View"` }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      // 4. Manually trigger the Reconciler
      Reconciler.reconcile(file, definition);
    }
  }
}
