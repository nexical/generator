import { type FileDefinition, type FunctionConfig, type NodeContainer } from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';

export class InitBuilder extends BaseBuilder {
  constructor(private type: 'server' | 'client') {
    super();
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    if (this.type === 'server') {
      return this.getServerSchema(node);
    } else {
      return this.getClientSchema(node);
    }
  }

  private getServerSchema(node?: NodeContainer): FileDefinition {
    const initFunc: FunctionConfig = {
      name: 'init',
      isExported: true,
      isAsync: true,
      overwriteBody: true,
      parameters: [],
      statements: [TemplateLoader.load('init/server.tsf')],
    };

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports: [
        {
          moduleSpecifier: '@/lib/registries/role-registry',
          namedImports: ['roleRegistry', 'type RolePolicy'],
        },
        { moduleSpecifier: '@/lib/security/permissions', namedImports: ['Permissions'] },
      ],
      functions: [initFunc],
    };
  }

  private getClientSchema(node?: NodeContainer): FileDefinition {
    const initFunc: FunctionConfig = {
      name: 'init',
      isExported: true,
      isAsync: true,
      overwriteBody: true,
      parameters: [],
      statements: [TemplateLoader.load('init/client.tsf')],
    };

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      functions: [initFunc],
    };
  }
}
