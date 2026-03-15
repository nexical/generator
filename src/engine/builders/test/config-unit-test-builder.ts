import { type FileDefinition, type NodeContainer } from '../../types.js';
import { BaseBuilder } from '../base-builder.js';
import { TemplateLoader } from '../../../utils/template-loader.js';

export class ConfigUnitTestBuilder extends BaseBuilder {
  constructor(
    private configName: string,
    private configPath: string, // Relative path from test to config file
  ) {
    super();
  }

  protected getSchema(_node?: NodeContainer): FileDefinition {
    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      statements: [
        TemplateLoader.load('test/unit/config.tsf', {
          configName: this.configName,
          configPath: this.configPath,
        }),
      ],
    };
  }
}
