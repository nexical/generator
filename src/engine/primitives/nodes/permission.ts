import type { SourceFile } from 'ts-morph';
import type { PermissionDefinition, StatementConfig } from '../../types.js';
import { VariablePrimitive } from './variable.js';
import { TypePrimitive } from './type.js';
import { ClassPrimitive } from './class.js';
import { MethodPrimitive } from './method.js';
import { ImportPrimitive } from '../core/import-manager.js';
import type { ValidationResult } from '../../primitives/contracts.js';

export class PermissionPrimitive {
  constructor(
    private permissions: Record<string, PermissionDefinition>,
    private rolePermissions?: Record<string, string[]>,
  ) {}

  ensure(sourceFile: SourceFile): void {
    // 1. Generate Permission Registry Variable (Descriptions)
    // export const PermissionRegistry = { ... } as const;
    const initializer = JSON.stringify(this.permissions, null, 2);

    new VariablePrimitive({
      name: 'PermissionRegistry',
      declarationKind: 'const',
      isExported: true,
      initializer: `${initializer} as const`,
    }).ensure(sourceFile);

    // 1b. Import Core Permissions
    new ImportPrimitive({
      moduleSpecifier: '@/lib/security/permissions',
      namedImports: ['Permissions'],
    }).ensure(sourceFile);

    // 2. Generate Permission Type
    // export type PermissionAction = keyof typeof PermissionRegistry;
    new TypePrimitive({
      name: 'PermissionAction',
      isExported: true,
      type: 'keyof typeof PermissionRegistry',
    }).ensure(sourceFile);

    // 3. Generate RolePermissions Map (if provided)
    if (this.rolePermissions) {
      new VariablePrimitive({
        name: 'RolePermissions',
        declarationKind: 'const',
        isExported: true,
        initializer: `${JSON.stringify(this.rolePermissions, null, 2)} as const`,
      }).ensure(sourceFile);
    }

    // 4. Generate Permission Class with static check
    const classPrimitive = new ClassPrimitive({
      name: 'Permission',
      isExported: true,
    });
    const classNode = classPrimitive.ensure(sourceFile);

    const checkStatements: StatementConfig[] = [];

    if (this.rolePermissions) {
      checkStatements.push({
        kind: 'return',
        expression: 'Permissions.check(action, role)',
      });
    } else {
      // Fallback if no role map is present
      checkStatements.push({
        kind: 'return',
        expression: 'false',
      });
    }

    new MethodPrimitive({
      name: 'check',
      isStatic: true,
      isAsync: false,
      parameters: [
        { name: 'action', type: 'PermissionAction' },
        { name: 'role', type: 'string' },
      ],
      returnType: 'boolean',
      statements: checkStatements,
    }).ensure(classNode);
  }

  find(sourceFile: SourceFile) {
    return sourceFile.getVariableDeclaration('PermissionRegistry');
  }

  validate(node: unknown): ValidationResult {
    return { valid: true, issues: [] };
  }
}
