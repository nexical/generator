import { Scope } from 'ts-morph';
import {
  type FileDefinition,
  type ClassDefinition,
  type NodeContainer,
  type ImportConfig,
  type RoleConfig,
} from '../types.js';
import { toPascalCase } from '../../utils/string.js';
import { BaseBuilder } from './base-builder.js';

export class RoleBuilder extends BaseBuilder {
  constructor(private roleConfig: RoleConfig) {
    super();
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    const { name, definition } = this.roleConfig;
    // PascalCase the role name for the class, e.g. TEAM-OWNER -> TeamOwnerRole
    const pascalName = toPascalCase(name);
    const className = `${pascalName}Role`;

    const roleClass: ClassDefinition = {
      name: className,
      extends: 'BaseRole',
      isExported: true,
      docs: definition.description ? [definition.description] : [],
      properties: [
        {
          name: 'name',
          type: 'string',
          initializer: `'${name}'`,
          readonly: true,
        },
        {
          name: 'description',
          type: 'string',
          initializer: `'${definition.description || ''}'`,
          readonly: true,
        },
        {
          name: 'inherits',
          type: 'string[]',
          initializer: `[${(definition.inherits || []).map((r: string) => `'${r}'`).join(', ')}]`,
          readonly: true,
        },
        {
          name: 'permissions',
          type: 'string[]',
          initializer: `[${(definition.permissions || []).map((p: string) => `'${p}'`).join(', ')}]`,
          readonly: true,
        },
        {
          name: 'compatibleRoles',
          type: 'string[]',
          initializer: `[${(this.roleConfig.compatibleRoles || []).map((r: string) => `'${r}'`).join(', ')}]`,
          readonly: true,
          scope: Scope.Protected,
        },
      ],
    };

    const imports: ImportConfig[] = [
      {
        moduleSpecifier: './base-role',
        namedImports: ['BaseRole'],
      },
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
      header:
        '// GENERATED CODE - THE SIGNATURE IS MANAGED BY THE GENERATOR. YOU MAY MODIFY THE IMPLEMENTATION AND ADD CUSTOM IMPORTS.',
      imports: Array.from(importMap.values()),
      classes: [roleClass],
    };
  }
}
