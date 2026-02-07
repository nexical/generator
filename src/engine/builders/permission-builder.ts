import {
  type FileDefinition,
  type ClassDefinition,
  type NodeContainer,
  type ImportConfig,
} from '../types.js';
import { Reconciler } from '../reconciler.js';
import { TemplateLoader } from '../../utils/template-loader.js';

export class PermissionBuilder {
  constructor(
    private actionName: string,
    // private context: PermissionContext
  ) {}

  private getSchema(): FileDefinition {
    // Class Name: RegisterUserPermission
    const className = `${this.actionName}Permission`;

    const permissionClass: ClassDefinition = {
      name: className,
      isExported: true,
      methods: [
        {
          name: 'check',
          isAsync: true,
          isStatic: true,
          parameters: [
            { name: 'context', type: 'APIContext' },
            { name: 'input', type: 'unknown', optional: true },
          ],
          returnType: 'Promise<void>',
          statements: [
            TemplateLoader.load('permission/check.tsf', { actionName: this.actionName }),
          ],
        },
      ],
    };

    const imports: ImportConfig[] = [
      { moduleSpecifier: 'astro', namedImports: ['APIContext'], isTypeOnly: true },
    ];

    return {
      imports,
      classes: [permissionClass],
    };
  }

  ensure(sourceFile: NodeContainer): void {
    Reconciler.reconcile(sourceFile, this.getSchema());
  }
}
