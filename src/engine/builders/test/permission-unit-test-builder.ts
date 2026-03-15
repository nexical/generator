import { type FileDefinition } from '../../types.js';
import { BaseBuilder } from '../base-builder.js';
import { ts } from '../../primitives/statements/factory.js';

export class PermissionUnitTestBuilder extends BaseBuilder {
  constructor(private moduleName: string) {
    super();
  }

  protected getSchema(): FileDefinition {
    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      statements: [
        ts`import { describe, it, expect, vi } from 'vitest';
import { Permission } from '../../src/permissions';

describe('Permission', () => {
    it('should be defined', () => {
        expect(Permission).toBeDefined();
    });

    it('should have a check method', () => {
        expect(typeof Permission.check).toBe('function');
    });

    it('should call Permission.check and not throw', () => {
        // Smoke test for the permission check mapping
        expect(() => Permission.check('user:list' as any, 'USER_ADMIN')).not.toThrow();
    });
});`,
      ],
    };
  }
}
