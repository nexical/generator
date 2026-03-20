import { SyntaxKind, VariableDeclarationKind, type CallExpression } from 'ts-morph';
import { ModuleGenerator } from './module-generator.js';
import { FormBuilder } from './builders/ui/form-builder.js';
import { TableBuilder } from './builders/ui/table-builder.js';
import { I18nBuilder } from './builders/i18n-builder.js';
import { MiddlewareBuilder } from './builders/middleware-builder.js';
import {
  type ModuleConfig,
  type ModelDef,
  type UiModuleConfig,
  type AccessConfig,
} from './types.js';
import { FrontendRolePrimitive } from './primitives/nodes/frontend-role.js';
import { Reconciler } from './reconciler.js';
import path from 'node:path';
import fs from 'node:fs';
import { parse } from 'yaml';
import { PathResolver } from '../utils/path-resolver.js';
import { TemplateLoader } from '../utils/template-loader.js';

import { glob } from 'glob';

export class UiModuleGenerator extends ModuleGenerator {
  async run(): Promise<void> {
    await PathResolver.init();
    const config = {
      type: 'feature',
      order: 100,
    } as unknown as ModuleConfig; // Defaults, as we don't strictly parsing module.config.mjs here yet

    console.error(`[UiModuleGenerator] Running for ${this.moduleName} at ${this.modulePath}`);

    // 0. Parse ui.yaml
    const uiYamlPath = path.join(this.modulePath, 'ui.yaml');
    let uiConfig: UiModuleConfig = {};
    if (fs.existsSync(uiYamlPath)) {
      try {
        uiConfig = parse(fs.readFileSync(uiYamlPath, 'utf-8')) as UiModuleConfig;
      } catch (e) {
        console.error(`[UiModuleGenerator] Failed to parse ui.yaml: ${e}`);
      }
    }

    // Run Builders
    await new FormBuilder(this.moduleName, config, this.modulePath).build(this.project, undefined);
    await new TableBuilder(this.moduleName, config, this.modulePath).build(this.project, undefined);

    // Run I18n Builder last to capture all registered keys
    await new I18nBuilder(this.moduleName, this.modulePath).build(this.project);

    // Run Middleware Builder (Virtual User Actor for Session)
    const virtualUserModel: ModelDef = {
      name: 'User',
      api: false,
      db: false,
      isExported: false,
      default: false,
      extended: false,
      fields: {},
      actor: {
        strategy: 'login',
        name: 'user',
      },
    };
    const middlewareFile = this.getOrCreateFile('src/middleware.ts');
    new MiddlewareBuilder([virtualUserModel], []).ensure(middlewareFile);

    // --- Role Generation ---
    if (uiConfig.backend) {
      const backendModulePath = await PathResolver.resolve(uiConfig.backend);
      const accessYamlPath = path.join(backendModulePath, 'access.yaml');

      if (fs.existsSync(accessYamlPath)) {
        console.error(`[UiModuleGenerator] Found linked backend access.yaml at ${accessYamlPath}`);
        try {
          const parsedAccess = parse(fs.readFileSync(accessYamlPath, 'utf-8'));
          const accessConfig = (parsedAccess.config || parsedAccess) as AccessConfig;

          if (accessConfig.roles) {
            // 1. Generate Frontend BaseRole
            const baseRoleFile = this.getOrCreateFile('src/roles/base-role.ts');
            Reconciler.reconcile(baseRoleFile, {
              header: '// GENERATED CODE - DO NOT MODIFY',
              statements: [TemplateLoader.load('roles/ui-base-role.tsf')],
            });

            // 2. Generate Individual Roles
            for (const [roleName, roleDef] of Object.entries(accessConfig.roles)) {
              console.error(`[UiModuleGenerator] Generating Frontend Role: ${roleName}`);
              const pascalName = roleName.charAt(0).toUpperCase() + roleName.slice(1).toLowerCase();
              const roleFile = this.getOrCreateFile(`src/roles/${pascalName.toLowerCase()}.ts`);

              // Use the new FrontendRolePrimitive
              new FrontendRolePrimitive({
                name: roleName,
                definition: roleDef,
              }).ensure(roleFile);
            }

            // 3. Generate System Roles (Anonymous, Member)
            // These are standard presets for UI logic, even if not in backend DB roles.

            // AnonymousRole: Always allows access
            const anonFile = this.getOrCreateFile('src/roles/anonymous.ts');
            Reconciler.reconcile(anonFile, {
              header: '// GENERATED CODE - DO NOT MODIFY',
              statements: [TemplateLoader.load('roles/ui-anonymous-role.tsf')],
            });

            // MemberRole: Requires login, but no specific role
            const memberFile = this.getOrCreateFile('src/roles/member.ts');
            Reconciler.reconcile(memberFile, {
              header: '// GENERATED CODE - DO NOT MODIFY',
              statements: [TemplateLoader.load('roles/ui-member-role.tsf')],
            });
          }
        } catch (e) {
          console.error(`[UiModuleGenerator] Failed to process access.yaml: ${e}`);
        }
      } else {
        console.warn(
          `[UiModuleGenerator] Linked backend module '${uiConfig.backend}' does not have an access.yaml`,
        );
      }
    }

    // 4. Run Custom Builders
    await this.runCustomBuilders({ uiConfig });

    await this.saveAll();

    // 5. Optimize for Hybrid Rendering (Cloudflare SSR)
    // Run AFTER saveAll to ensure ts-morph doesn't overwrite manual FS changes
    await this.optimizeHybridRendering();
  }

  private async optimizeHybridRendering() {
    const pagesPattern = path.join(this.modulePath, 'src/pages/**/*.astro');
    console.error(`[UiModuleGenerator] Optimizing Hybrid Rendering. Scanning: ${pagesPattern}`);

    const astroFiles = await glob(pagesPattern);
    console.error(`[UiModuleGenerator] Found ${astroFiles.length} .astro files.`);

    for (const file of astroFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\n---/);

        let frontmatter = '';
        let rest = content;

        if (frontmatterMatch) {
          frontmatter = frontmatterMatch[1];
          rest = content.replace(frontmatterMatch[0], '').trimStart();
        }

        const tempFile = this.project.createSourceFile(`__astro_fm_${Date.now()}.ts`, frontmatter);

        try {
          const hasPageGuard = tempFile
            .getDescendantsOfKind(SyntaxKind.CallExpression)
            .some((c) => (c as CallExpression).getExpression().getText() === 'PageGuard.protect');

          if (hasPageGuard || content.includes('PageGuard.protect')) {
            const hasPrerender = tempFile.getVariableStatement('prerender');
            if (
              !hasPrerender ||
              hasPrerender.getDeclarations()[0].getInitializer()?.getText() !== 'false'
            ) {
              console.error(
                `[UiModuleGenerator] Enhancing ${path.basename(file)} with SSR (prerender = false)`,
              );

              if (hasPrerender) {
                hasPrerender.getDeclarations()[0].setInitializer('false');
              } else {
                tempFile.addVariableStatement({
                  declarationKind: VariableDeclarationKind.Const,
                  declarations: [{ name: 'prerender', initializer: 'false' }],
                  isExported: true,
                });
              }

              const newFrontmatter = `---\n${tempFile.getFullText().trim()}\n---`;
              fs.writeFileSync(file, `${newFrontmatter}\n${rest}`, 'utf-8');
            }
          }
        } finally {
          tempFile.delete();
        }
      } catch (e) {
        console.warn(`[UiModuleGenerator] Failed to optimize ${file}: ${e}`);
      }
    }
  }
}
