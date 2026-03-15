import { type FileDefinition, type NodeContainer } from '../../types.js';
import { BaseBuilder } from '../base-builder.js';
import { TemplateLoader } from '../../../utils/template-loader.js';

export class AgentUnitTestBuilder extends BaseBuilder {
  constructor(
    private className: string,
    private agentPath: string, // Relative path from test to agent file
  ) {
    super();
  }

  protected getSchema(_node?: NodeContainer): FileDefinition {
    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      statements: [
        TemplateLoader.load('test/unit/agent.tsf', {
          className: this.className,
          agentPath: this.agentPath,
        }),
      ],
    };
  }
}
