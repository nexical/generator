import { type FileDefinition, type NodeContainer } from '../../types.js';
import { BaseBuilder } from '../base-builder.js';
import { TemplateLoader } from '../../../utils/template-loader.js';

export class RoleUnitTestBuilder extends BaseBuilder {
  constructor(
    private className: string,
    private roleName: string,
    private rolePath: string, // Relative path from test to role file
    private compatibleRoles: string[] = [],
  ) {
    super();
  }

  protected getSchema(_node?: NodeContainer): FileDefinition {
    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      statements: [
        TemplateLoader.load('test/unit/role.tsf', {
          className: this.className,
          roleName: this.roleName,
          rolePath: this.rolePath,
          compatibleRoles: JSON.stringify(this.compatibleRoles),
        }),
      ],
    };
  }
}
