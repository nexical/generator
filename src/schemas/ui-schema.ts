import { z } from 'zod';

export const UiPageSchema = z.object({
  path: z.string(),
  layout: z.string().optional(),
  component: z.string(),
  meta: z
    .object({
      title: z.string().optional(),
    })
    .optional(),
  permissions: z.array(z.string()).optional(),
  guard: z.array(z.string()).optional(), // Alias for permissions often used
});

export const UiShellSchema = z.object({
  name: z.string(),
  matcher: z.object({
    path: z.string(),
  }),
});

export const UiRegistryItemSchema = z.object({
  zone: z.string(),
  component: z.string(),
  order: z.number().optional(),
  permissions: z.array(z.string()).optional(),
});

export const UiFormConfigSchema = z.record(
  z.string(), // Field Name
  z.object({
    component: z
      .object({
        name: z.string(),
        path: z.string(),
        props: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
  }),
);

export const UiTableConfigSchema = z.object({
  editMode: z.enum(['sheet', 'dialog', 'inline']).optional(),
  columns: z.record(z.string(), z.unknown()).optional(), // Placeholder
});

export const UiConfigSchema = z.object({
  backend: z.string().optional(),
  prefix: z.string().optional(),
  pages: z.array(UiPageSchema).optional(),
  shells: z.array(UiShellSchema).optional(),
  registry: z.array(UiRegistryItemSchema).optional(), // Array based on user-ui.yaml
  registries: z.record(z.string(), z.array(UiRegistryItemSchema)).optional(), // Suppport types.ts definition just in case
  forms: z.record(z.string(), UiFormConfigSchema).optional(), // Model -> Fields
  tables: z.record(z.string(), UiTableConfigSchema).optional(), // Model -> Config
});

export type UiConfig = z.infer<typeof UiConfigSchema>;
