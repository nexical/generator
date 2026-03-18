import { type FileDefinition, type NodeContainer, type ModelDef } from '../../../types.js';
import { BaseBuilder } from '../../base-builder.js';
import { TemplateLoader } from '../../../../utils/template-loader.js';

export class MiddlewareUnitTestBuilder extends BaseBuilder {
  constructor(
    private moduleName: string,
    private middlewarePath: string, // Relative path from test to middleware
    private models: ModelDef[] = [],
  ) {
    super();
  }

  protected getSchema(_node?: NodeContainer): FileDefinition {
    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      statements: [
        TemplateLoader.load('test/unit/middleware.tsf', {
          moduleName: this.moduleName,
          middlewarePath: this.middlewarePath,
          models: this.models,
        }),
      ],
    };
  }
}
