import { z } from 'zod';

/**
 * Zod schema for validating the audit target configuration.
 */
export const AuditExampleSchema = z.object({
  version: z.string().default('1.0.0'),
  features: z.array(z.string()),
  settings: z
    .object({
      strict: z.boolean().default(true),
      prune: z.boolean().default(false),
    })
    .optional(),
});

export type AuditExampleConfig = z.infer<typeof AuditExampleSchema>;
