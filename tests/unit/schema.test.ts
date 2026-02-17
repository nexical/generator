/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  PlatformDefinitionSchema,
  PrismaModelSchema,
  PlatformApiDefinitionSchema,
} from '../../src/schemas/api-schema';

describe('Schema Validation', () => {
  describe('PrismaModelSchema', () => {
    it('should validate a valid model with features', () => {
      const validModel = {
        fields: {
          name: 'String',
          age: { type: 'Int', isRequired: false },
        },
        features: {
          crud: true,
          search: ['name'],
        },
      };
      const result = PrismaModelSchema.safeParse(validModel);
      expect(result.success).toBe(true);
    });

    it('should validate an actor model', () => {
      const actorModel = {
        fields: {
          email: 'String',
          password: 'String',
        },
        actor: {
          strategy: 'login',
          fields: { username: 'email' },
        },
      };
      const result = PrismaModelSchema.safeParse(actorModel);
      expect(result.success).toBe(true);
    });

    it('should fail on invalid actor strategy', () => {
      const invalidModel = {
        fields: { name: 'String' },
        actor: { strategy: 'invalid' },
      };
      const result = PrismaModelSchema.safeParse(invalidModel);
      expect(result.success).toBe(false);
    });
  });

  describe('PlatformDefinitionSchema', () => {
    it('should validate a full platform definition', () => {
      const definition = {
        models: {
          User: {
            fields: { name: 'String' },
          },
        },
        enums: {
          Role: {
            values: ['ADMIN', 'USER'],
          },
        },
      };
      const result = PlatformDefinitionSchema.safeParse(definition);
      expect(result.success).toBe(true);
    });
  });

  describe('PlatformApiDefinitionSchema', () => {
    it('should validate API routes', () => {
      const apiDef = {
        User: [
          {
            method: 'list',
            path: '/users',
            verb: 'GET',
            summary: 'List users',
          },
          {
            method: 'create',
            path: '/users',
            verb: 'POST',
            input: 'CreateUserInput',
          },
        ],
      };
      const result = PlatformApiDefinitionSchema.safeParse(apiDef);
      expect(result.success).toBe(true);
    });
  });
});
