import { BaseCommand } from '@nexical/cli-core';
import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { ModuleLocator, type ModuleInfo } from './module-locator.js';
import { UiConfigSchema, type UiConfig } from '../schemas/ui-schema.js';

export async function auditUiModule(
  command: BaseCommand,
  name: string | undefined,
  options: { schema?: boolean },
) {
  const pattern = name || '*-ui';
  const modules = await ModuleLocator.expand(pattern);

  if (modules.length === 0) {
    command.warn(`No modules found matching pattern "${pattern}"`);
    return;
  }

  command.info(`Found ${modules.length} module(s) to audit.`);

  let totalIssues: string[] = [];

  for (const moduleInfo of modules) {
    command.info(`Auditing module: ${moduleInfo.name} `);
    const issues = await auditModule(command, moduleInfo, options.schema || false);
    totalIssues = totalIssues.concat(issues);
  }

  if (totalIssues.length > 0) {
    command.error(`Audit failed with ${totalIssues.length} issues: `);
    totalIssues.forEach((issue) => command.info(issue));
    // Implementation note: BaseCommand error typically exits.
    // If running in bulk, we might want to collect all then fail,
    // but standard behavior here is fine.
  } else {
    command.success(`Audit passed for all ${modules.length} modules.`);
  }
}

export async function auditModule(
  command: BaseCommand,
  moduleInfo: ModuleInfo,
  checkSchemaOnly: boolean,
): Promise<string[]> {
  const { name, path: moduleDir } = moduleInfo;
  const uiYamlPath = path.join(moduleDir, 'ui.yaml');
  const issues: string[] = [];
  const report = (msg: string) => issues.push(`[${name}] ${msg}`);

  // 1. Check ui.yaml existence
  if (!fs.existsSync(uiYamlPath)) {
    report(`Missing ui.yaml`);
    return issues;
  }

  // 2. Parse and Validate Schema
  let uiConfig: UiConfig;
  try {
    const content = fs.readFileSync(uiYamlPath, 'utf-8');
    const parsed = YAML.parse(content);
    const result = UiConfigSchema.safeParse(parsed);

    if (!result.success) {
      result.error.issues.forEach((err) => {
        report(`Schema Error: ${err.path.join('.')} - ${err.message}`);
      });
      return issues; // Stop if schema is invalid
    }
    uiConfig = result.data;
  } catch (e) {
    report(`Failed to parse ui.yaml: ${e instanceof Error ? e.message : String(e)}`);
    return issues;
  }

  if (checkSchemaOnly) {
    return issues;
  }

  // 3. Code Audit / Existence Checks

  // Check Backend Link
  if (uiConfig.backend) {
    // Basic connectivity check: does backend module exist?
    // Using simple path assumption ../../../backend/modules/{backend}
    // This depends on monorepo structure.
    const backendPath = path.resolve(moduleDir, '../../../backend/modules', uiConfig.backend);
    if (!fs.existsSync(backendPath)) {
      report(`Linked backend '${uiConfig.backend}' not found at ${backendPath}`);
    } else {
      // Check for generated roles if backend exists
      // The generator generates `src/roles/base-role.ts` and others.
      const baseRolePath = path.join(moduleDir, 'src/roles/base-role.ts');
      if (!fs.existsSync(baseRolePath)) {
        report(`Missing generated file: src/roles/base-role.ts (Run 'gen ui ${name}')`);
      }

      const middlewarePath = path.join(moduleDir, 'src/middleware.ts');
      if (!fs.existsSync(middlewarePath)) {
        report(`Missing generated file: src/middleware.ts (Run 'gen ui ${name}')`);
      }
    }
  }

  // Check Pages
  if (uiConfig.pages) {
    for (const _page of uiConfig.pages) {
      // 1. Component existence
      // If component is "Login", usually implies src/components/Login.astro?
      // Or src/pages/.../Login.astro?
      // UiModuleGenerator doesn't enforce this mapping strictly, but let's assume
      // standard Astro structure: src/components/{Component}.astro OR src/pages/{Component}.astro
      // For now, let's just check if the PAGE COMPONENT exists if it looks like a file path.
      // Actually, 'component: Login' usually maps to an import.
      // Without alias resolution, it's hard to verify exactly.
      // But we CAN verify the ROUTE path exists in src/pages if it's a page definition.
      // path: /login -> src/pages/login.astro or src/pages/login/index.astro
      // const routePath = page.path;
      // // remove leading slash, handle params [id]
      // const relativePath = routePath.startsWith('/') ? routePath.slice(1) : routePath;
      // Potential locations
      // const candidates = [
      //    path.join(moduleDir, 'src/pages', `${relativePath}.astro`),
      //    path.join(moduleDir, 'src/pages', relativePath, 'index.astro'),
      // ];
      // Try to find if at least one candidate exists?
      // For '/admin/users', it could be src/pages/admin/users.astro.
      // If none found, warn?
      // let found = candidates.some(p => fs.existsSync(p));
      // if (!found) {
      //   report(`Page route '${page.path}' not found in src/pages/ (Expected .astro file)`);
      // }
      // Component check (UserMenu, etc) - often in src/components
      // if (page.component) ...
    }
  }

  // Check Registry
  if (uiConfig.registry) {
    for (const _item of uiConfig.registry) {
      // Check component: 'UserMenu'
      // Should exist in src/components/UserMenu.astro or similar?
      // Hard to enforce without import map.
      // We'll skip strict component file checks for now to avoid false positives.
    }
  }

  return issues;
}
