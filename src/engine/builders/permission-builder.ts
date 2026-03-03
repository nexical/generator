import {
  type FileDefinition,
  type ClassDefinition,
  type NodeContainer,
  type ImportConfig,
} from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';

export class PermissionBuilder extends BaseBuilder {
  constructor(private actionName: string) {
    super();
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
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

    // Preserve existing manual imports
    const existingImports = this.getExistingImports(node);
    const importMap = new Map<string, ImportConfig>();

    // Add generated imports first
    imports.forEach((imp) => importMap.set(imp.moduleSpecifier, imp));

    // Add existing imports if not already present or merge named imports
    existingImports.forEach((existing) => {
      const existingSpecifier = existing.moduleSpecifier;
      if (importMap.has(existingSpecifier)) {
        const generated = importMap.get(existingSpecifier)!;
        if (existing.namedImports && generated.namedImports) {
          const mergedNames = [...new Set([...generated.namedImports, ...existing.namedImports])];
          generated.namedImports = mergedNames;
        }
      } else {
        importMap.set(existingSpecifier, existing);
      }
    });

    return {
      header: '// GENERATED CODE - THE SIGNATURE IS MANAGED BY THE GENERATOR. YOU MAY MODIFY THE IMPLEMENTATION AND ADD CUSTOM IMPORTS.',
      imports: Array.from(importMap.values()),
      classes: [permissionClass],
    };
  }
}
