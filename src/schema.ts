import { z } from 'zod';

// --- Primitives ---

export const PlatformFeatureSearchSchema = z.array(z.string()).optional();
export const PlatformFeatureCrudSchema = z.boolean().optional().default(false);
export const PlatformFeatureHistorySchema = z.boolean().optional().default(false);

export const PlatformModelFeaturesSchema = z.object({
  crud: PlatformFeatureCrudSchema,
  search: PlatformFeatureSearchSchema,
  history: PlatformFeatureHistorySchema,
});

// --- Existing Models (Partial) ---
// We only validate what we need to generate code, trusting the rest is valid for Prisma.

export const PrismaFieldSchema = z.object({
  type: z.string(),
  isList: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  attributes: z.array(z.string()).optional(),
  private: z.boolean().optional(),
});

export const PrismaModelSchema = z.object({
  fields: z.record(z.string(), z.union([z.string(), PrismaFieldSchema])),
  attributes: z.array(z.string()).optional(),
  // NEW: Platform Generation Config
  features: PlatformModelFeaturesSchema.optional(),
  // Validation Overrides
  role: z.union([z.string(), z.record(z.string())]).optional(),
  default: z.boolean().optional(),
  api: z.boolean().optional(),
  db: z.boolean().optional(),
  extended: z.boolean().optional(),
  actor: z
    .object({
      strategy: z.enum(['login', 'api-key']),
      fields: z.record(z.string()).optional(),
    })
    .optional(),
});

export const PrismaEnumSchema = z.object({
  values: z.array(z.string()),
});

export const PlatformDefinitionSchema = z.object({
  models: z.record(z.string(), PrismaModelSchema).optional(),
  enums: z.record(z.string(), PrismaEnumSchema).optional(),
});

// --- API Schema ---

export const PlatformApiRouteSchema = z.object({
  method: z.string(),
  path: z.string(),
  verb: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  summary: z.string().optional(),
  input: z.string().optional(),
  output: z.string().optional(),
  role: z.string().optional(),
});

export const PlatformApiDefinitionSchema = z.record(
  z.string(), // Entity Name
  z.array(PlatformApiRouteSchema),
);

export type PlatformDefinition = z.infer<typeof PlatformDefinitionSchema>;
export type PlatformModel = z.infer<typeof PrismaModelSchema>;
export type PlatformModelFeatures = z.infer<typeof PlatformModelFeaturesSchema>;
export type PlatformApiDefinition = z.infer<typeof PlatformApiDefinitionSchema>;
