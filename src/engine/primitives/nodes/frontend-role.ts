import type { SourceFile } from 'ts-morph';
import type { RoleConfig } from '../../types.js';
import { ClassPrimitive } from './class.js';
import { ImportPrimitive } from '../core/import-manager.js';
import { PropertyPrimitive } from './property.js';
import type { ValidationResult } from '../../primitives/contracts.js';

export class FrontendRolePrimitive {
  constructor(private config: RoleConfig) {}

  ensure(sourceFile: SourceFile): void {
    const { name, definition } = this.config;
    // PascalCase the role name for the class, e.g. ADMIN -> AdminRole
    const pascalName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    const className = `${pascalName}Role`;

    // 1. Ensure Imports
    new ImportPrimitive({
      moduleSpecifier: './base-role',
      namedImports: ['BaseRole'],
    }).ensure(sourceFile);

    // 2. Create Class
    const classPrimitive = new ClassPrimitive({
      name: className,
      extends: 'BaseRole',
      isExported: true,
      docs: definition.description ? [definition.description] : [],
    });

    const classNode = classPrimitive.ensure(sourceFile);

    // 3. Add Properties (Optional, mainly for metadata parity with backend roles)
    const properties = [
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
    ];

    properties.forEach((prop) => {
      new PropertyPrimitive(prop).ensure(classNode);
    });
  }

  find(sourceFile: SourceFile) {
    const { name } = this.config;
    const pascalName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    const className = `${pascalName}Role`;
    return sourceFile.getClass(className);
  }

  validate(node: unknown): ValidationResult {
    return { valid: true, issues: [] };
  }
}
