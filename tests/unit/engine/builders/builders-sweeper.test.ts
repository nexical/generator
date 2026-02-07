/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { FactoryBuilder } from '../../../../src/engine/builders/factory-builder';
import { TestBuilder } from '../../../../src/engine/builders/test-builder';
import { type ModelDef, type ParsedStatement } from '../../../../src/engine/types';

describe('Builders Sweeper', () => {
  describe('FactoryBuilder Edge Cases', () => {
    it('should handle boolean, datetime, enums, list types, and password', () => {
      const model: ModelDef = {
        name: 'ComplexModel',
        api: true,
        fields: {
          id: { type: 'String', isRequired: true },
          isActive: { type: 'boolean', isRequired: true },
          bornAt: { type: 'datetime', isRequired: true }, // Changed from createdAt
          role: { type: 'SiteRole', isRequired: true },
          status: { type: 'UserStatus', isRequired: true },
          mode: { type: 'UserMode', isRequired: true },
          tags: { type: 'String', isRequired: true, isList: true },
          password: { type: 'String', isRequired: true },
        },
      } as unknown as ModelDef;

      const builder = new FactoryBuilder([model]);
      const file = (
        builder as unknown as {
          getSchema: () => { variables: { initializer: string | ParsedStatement }[] };
        }
      ).getSchema();
      const initializer = file.variables?.[0].initializer;
      const content =
        typeof initializer === 'string' ? initializer : (initializer as ParsedStatement)?.raw || '';

      expect(content).toContain('isActive: true');
      expect(content).toContain('bornAt: new Date()'); // Changed expectation
      expect(content).toContain("role: 'EMPLOYEE'");
      expect(content).toContain("status: 'ACTIVE'");
      expect(content).toContain("mode: 'SINGLE'");
      expect(content).toContain('tags: [`tags_${index}`]'); // Expected list format?
      expect(content).toContain("password: hashPassword('Password123!')");
    });
  });

  describe('TestBuilder Edge Cases', () => {
    const baseModel: ModelDef = {
      name: 'TestModel',
      api: true,
      fields: { id: { type: 'String', isRequired: true } },
      test: { actor: 'User' },
    } as unknown as ModelDef;

    it('should use role object configuration', () => {
      const model: ModelDef = {
        ...baseModel,
        role: { create: 'admin' }, // Object role config
      } as unknown as ModelDef;
      const builder = new TestBuilder(model, 'mod', 'create');
      // Just verifying it runs without error and internal logic holds
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      builder.validate({} as any); // Use a dummy for validate check
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schema = (builder as any).getSchema();
      expect(schema).toBeDefined();
    });

    it('should use roleConfig for actor options', () => {
      const builder = new TestBuilder(baseModel, 'mod', 'create', {
        member: { headers: { 'X-Custom': 'val' } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const file = (builder as any).getSchema();
      const statement = file.statements?.[0];
      const content =
        typeof statement === 'string' ? statement : (statement as ParsedStatement)?.raw || '';

      // Expect generated content (note: keys might be unquoted due to naive replacement in builder)
      expect(content).toContain('headers:');
      expect(content).toContain('X-Custom:');
      expect(content).toContain('val');
    });

    it('should fallback to user if actor is missing', () => {
      const model: ModelDef = { name: 'NoActor', api: true, fields: {} } as unknown as ModelDef;
      const builder = new TestBuilder(model, 'mod', 'create');
      const schema = (builder as unknown as { getSchema: () => unknown }).getSchema();
      expect(schema).toBeDefined();
    });

    it('should handle getActorRelationSnippet edge cases', () => {
      // Case 1: Recursive - Self reference check
      const teamModel: ModelDef = {
        name: 'Team',
        api: true,
        fields: { id: { type: 'String', isRequired: true } },
        test: { actor: 'Team' },
      } as unknown as ModelDef;
      const b1 = new TestBuilder(teamModel, 'mod', 'create');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s1 = (b1 as any).getSchema().statements?.[0];
      const c1 = typeof s1 === 'string' ? s1 : (s1 as ParsedStatement)?.raw || '';
      // Expect NOT to have actor override in payload for self-model?
      // Actually `generateCreateTests` checks `actorRelationField`.
      expect(c1).not.toContain('actorId: (actor ?');

      // Case 2: Explicit Actor Type Field match
      const jobModel: ModelDef = {
        name: 'Job',
        api: true,
        fields: {
          id: { type: 'String', isRequired: true },
          manager: { type: 'Manager', isRequired: true }, // Matches actor 'Manager'
        },
        test: { actor: 'Manager' },
      } as unknown as ModelDef;
      const b2 = new TestBuilder(jobModel, 'mod', 'create');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s2 = (b2 as any).getSchema().statements?.[0];
      const c2 = typeof s2 === 'string' ? s2 : (s2 as ParsedStatement)?.raw || '';
      // For CREATE, it generates: manager: (actor ? actor.id : undefined)
      expect(c2).toContain('manager: (actor ? (actor as any).id : undefined)');

      // Case 3: userId
      const postModel: ModelDef = {
        name: 'Post',
        api: true,
        fields: {
          id: { type: 'String', isRequired: true },
          userId: { type: 'String', isRequired: true },
        },
        test: { actor: 'User' },
      } as unknown as ModelDef;
      const b3 = new TestBuilder(postModel, 'mod', 'create');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s3 = (b3 as any).getSchema().statements?.[0];
      const c3 = typeof s3 === 'string' ? s3 : (s3 as ParsedStatement)?.raw || '';
      expect(c3).toContain('userId: (actor ? (actor as any).id : undefined)');
    });

    it('should find actor Foreign Key via regex', () => {
      const model: ModelDef = {
        name: 'UserSession', // Must contain "Session" to trigger auth resource logic
        api: true,
        fields: {
          id: { type: 'String', isRequired: true },
          owner: {
            type: 'User',
            isRequired: true,
            isRelation: true,
            attributes: ['@relation(fields: [ownerId], references: [id])'],
          },
          ownerId: { type: 'String', isRequired: true },
        },
        test: { actor: 'User' },
      } as unknown as ModelDef;

      const builder = new TestBuilder(model, 'mod', 'list');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const file = (builder as any).getSchema();
      const s = file.statements?.[0];
      const content = typeof s === 'string' ? s : (s as ParsedStatement)?.raw || '';

      expect(content).toContain('ownerId: { not: actor.id }');
    });

    it('should handle public role', () => {
      const model: ModelDef = {
        name: 'PublicResource',
        api: true,
        fields: { id: { type: 'String', isRequired: true } },
        role: 'public', // Short string format
        test: { actor: 'User' },
      } as unknown as ModelDef;
      const builder = new TestBuilder(model, 'mod', 'create');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const file = (builder as any).getSchema();
      const s = file.statements?.[0];
      const content = typeof s === 'string' ? s : (s as ParsedStatement)?.raw || '';

      expect(content).toContain('Public access - no auth required');
    });

    it('should select unique field for filtering', () => {
      const model: ModelDef = {
        name: 'UniqueResource',
        api: true,
        fields: {
          id: { type: 'String', isRequired: true },
          email: { type: 'String', isRequired: true, attributes: ['@unique'] },
          other: { type: 'String', isRequired: true },
        },
        test: { actor: 'User' },
      } as unknown as ModelDef;
      // List operation triggers valid filter generation
      const builder = new TestBuilder(model, 'mod', 'list');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const file = (builder as any).getSchema();
      const s = file.statements?.[0];
      const content = typeof s === 'string' ? s : (s as ParsedStatement)?.raw || '';

      // filter by 'other', creating 'email' unique values
      expect(content).toContain("email: 'filter_a_'");
      expect(content).toContain("email: 'filter_b_'");
    });
  });

  describe('FactoryBuilder Ignored Models', () => {
    it('should skip db:false models', () => {
      const model: ModelDef = {
        name: 'Ignored',
        api: true,
        db: false,
        fields: { id: { type: 'String', isRequired: true } },
      } as unknown as ModelDef;
      const builder = new FactoryBuilder([model]);
      const file = (
        builder as unknown as { getSchema: () => { variables: { initializer: string }[] } }
      ).getSchema();
      const initializer = file.variables[0].initializer;
      const content =
        typeof initializer === 'string' ? initializer : (initializer as ParsedStatement)?.raw || '';
      // Should have empty factories variable initializer (or just empty object)
      expect(content.replace(/\s/g, '')).toBe('{}');
    });
  });
});
