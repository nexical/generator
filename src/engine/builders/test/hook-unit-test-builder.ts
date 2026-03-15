import { type FileDefinition, type NodeContainer } from '../../types.js';
import { BaseBuilder } from '../base-builder.js';
import { TemplateLoader } from '../../../utils/template-loader.js';

export class HookUnitTestBuilder extends BaseBuilder {
  constructor(
    private hookName: string,
    private hookPath: string, // Relative path from test to hook file
  ) {
    super();
  }

  protected getSchema(_node?: NodeContainer): FileDefinition {
    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      statements: [
        TemplateLoader.load('test/unit/hook.tsf', {
          hookName: this.hookName,
          hookPath: this.hookPath,
        }),
      ],
    };
  }
}
