import { SourceFile } from 'ts-morph';
import { type FileDefinition, type NodeContainer } from '../../../types.js';
import { BaseBuilder } from '../../base-builder.js';
import { TemplateLoader } from '../../../../utils/template-loader.js';
import { toCamelCase } from '../../../../utils/string.js';

export interface ServiceInfo {
  name: string;
  path: string;
}

export class ActionUnitTestBuilder extends BaseBuilder {
  constructor(
    private actionName: string,
    private actionPath: string,
    private actionSource: SourceFile,
    private services: ServiceInfo[] = [],
    private entityName?: string,
  ) {
    super();
    this.discoverServices();
  }

  private discoverServices() {
    const imports = this.actionSource.getImportDeclarations();
    for (const imp of imports) {
      const modulePath = imp.getModuleSpecifierValue();
      const namedImports = imp.getNamedImports();
      for (const ni of namedImports) {
        const name = ni.getName();
        // We only care about Service classes for mocking
        if (name.endsWith('Service') && !this.services.find((s) => s.name === name)) {
          let relativePath = modulePath;
          if (modulePath.startsWith('.') || modulePath.startsWith('..')) {
            relativePath = `../../../src/actions/${modulePath}`;
          }

          this.services.push({ name, path: relativePath });
        }
      }
    }
  }

  protected getSchema(_node?: NodeContainer): FileDefinition {
    const camelEntity = this.entityName ? toCamelCase(this.entityName) : '';
    const servicesImports = this.services
      .map((s) => `import { ${s.name} } from '${s.path}';`)
      .join('\n');
    const servicesMocks = this.services.map((s) => `vi.mock('${s.path}');`).join('\n');

    // Actions usually deal with ACTIVE records unless it's an invite/auth flow
    const isAuthOrInvite =
      this.actionName.toLowerCase().includes('auth') ||
      this.actionName.toLowerCase().includes('invite') ||
      this.actionName.toLowerCase().includes('register');
    const defaultStatus = isAuthOrInvite ? 'PENDING' : 'ACTIVE';

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      statements: [
        TemplateLoader.load('test/unit/action.tsf', {
          actionName: this.actionName,
          actionPath: this.actionPath,
          servicesImports,
          servicesMocks,
          services: this.services,
          entityName: this.entityName || '',
          camelEntity,
          defaultStatus,
        }),
      ],
    };
  }
}
