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

import { glob } from 'glob';

export class UiModuleGenerator extends ModuleGenerator {
  async run(): Promise<void> {
    const config = {
      type: 'feature',
      order: 100,
    } as unknown as ModuleConfig; // Defaults, as we don't strictly parsing module.config.mjs here yet

    console.info(`[UiModuleGenerator] Running for ${this.moduleName}`);

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
      // apps/frontend/modules/user-ui -> ../../../apps/backend/modules/user-api
      const backendModulePath = path.resolve(
        this.modulePath,
        `../../../backend/modules/${uiConfig.backend}`,
      );
      const accessYamlPath = path.join(backendModulePath, 'access.yaml');

      if (fs.existsSync(accessYamlPath)) {
        console.info(`[UiModuleGenerator] Found linked backend access.yaml at ${accessYamlPath}`);
        try {
          const parsedAccess = parse(fs.readFileSync(accessYamlPath, 'utf-8'));
          const accessConfig = (parsedAccess.config || parsedAccess) as AccessConfig;

          if (accessConfig.roles) {
            // 1. Generate Frontend BaseRole
            const baseRoleFile = this.getOrCreateFile('src/roles/base-role.ts');
            Reconciler.reconcile(baseRoleFile, {
              header: '// GENERATED CODE - DO NOT MODIFY',
              imports: [
                {
                  moduleSpecifier: 'astro',
                  namedImports: ['AstroGlobal', 'APIContext'],
                  isTypeOnly: true,
                },
                {
                  moduleSpecifier: '@/lib/registries/role-registry',
                  namedImports: ['RolePolicy'],
                  isTypeOnly: true,
                },
              ],
              classes: [
                {
                  name: 'BaseRole',
                  isExported: true,
                  isAbstract: true,
                  implements: ['RolePolicy'],
                  methods: [
                    {
                      name: 'check',
                      isAsync: true,
                      parameters: [
                        { name: 'context', type: 'AstroGlobal | APIContext' },
                        { name: 'input', type: 'Record<string, unknown>' },
                        { name: 'data', type: 'unknown', optional: true },
                      ],
                      returnType: 'Promise<void>',
                      statements: [
                        {
                          kind: 'variable',
                          declarationKind: 'const',
                          declarations: [
                            {
                              name: 'locals',
                              initializer: '(context as { locals?: App.Locals }).locals',
                            },
                          ],
                        },
                        {
                          kind: 'variable',
                          declarationKind: 'const',
                          declarations: [{ name: 'actor', initializer: 'locals?.actor' }],
                        },
                        {
                          kind: 'if',
                          condition: '!actor',
                          then: [
                            {
                              kind: 'throw',
                              expression: "new Error('Unauthorized: No actor found')",
                            },
                          ],
                        },
                        {
                          kind: 'if',
                          condition: '!actor.roles?.includes(this.name)',
                          then: [
                            {
                              kind: 'throw',
                              expression: 'new Error(`Forbidden: required role ${this.name}`)',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            });

            // 2. Generate Individual Roles
            for (const [roleName, roleDef] of Object.entries(accessConfig.roles)) {
              console.info(`[UiModuleGenerator] Generating Frontend Role: ${roleName}`);
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
              imports: [
                {
                  moduleSpecifier: 'astro',
                  namedImports: ['AstroGlobal', 'APIContext'],
                  isTypeOnly: true,
                },
                {
                  moduleSpecifier: '@/lib/registries/role-registry',
                  namedImports: ['RolePolicy'],
                  isTypeOnly: true,
                },
              ],
              classes: [
                {
                  name: 'AnonymousRole',
                  isExported: true,
                  implements: ['RolePolicy'],
                  methods: [
                    {
                      name: 'check',
                      isAsync: true,
                      isStatic: false,
                      parameters: [
                        { name: 'context', type: 'AstroGlobal | APIContext' },
                        { name: 'input', type: 'Record<string, unknown>' },
                        { name: 'data', type: 'unknown', optional: true },
                      ],
                      returnType: 'Promise<void>',
                      statements: [{ kind: 'return', expression: '' }],
                    },
                  ],
                },
              ],
            });

            // MemberRole: Requires login, but no specific role
            const memberFile = this.getOrCreateFile('src/roles/member.ts');
            Reconciler.reconcile(memberFile, {
              header: '// GENERATED CODE - DO NOT MODIFY',
              imports: [
                {
                  moduleSpecifier: 'astro',
                  namedImports: ['AstroGlobal', 'APIContext'],
                  isTypeOnly: true,
                },
                {
                  moduleSpecifier: '@/lib/registries/role-registry',
                  namedImports: ['RolePolicy'],
                  isTypeOnly: true,
                },
              ],
              classes: [
                {
                  name: 'MemberRole',
                  isExported: true,
                  implements: ['RolePolicy'],
                  methods: [
                    {
                      name: 'check',
                      isAsync: true,
                      isStatic: false,
                      parameters: [
                        { name: 'context', type: 'AstroGlobal | APIContext' },
                        { name: 'input', type: 'Record<string, unknown>' },
                        { name: 'data', type: 'unknown', optional: true },
                      ],
                      returnType: 'Promise<void>',
                      statements: [
                        {
                          kind: 'variable',
                          declarationKind: 'const',
                          declarations: [
                            {
                              name: 'locals',
                              initializer: '(context as { locals?: App.Locals }).locals',
                            },
                          ],
                        },
                        {
                          kind: 'if',
                          condition: '!locals?.actor',
                          then: [
                            {
                              kind: 'throw',
                              expression: "new Error('Unauthorized: Member access required')",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
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

    await this.saveAll();

    // 4. Optimize for Hybrid Rendering (Cloudflare SSR)
    // Run AFTER saveAll to ensure ts-morph doesn't overwrite manual FS changes
    await this.optimizeHybridRendering();
  }

  private async optimizeHybridRendering() {
    const pagesPattern = path.join(this.modulePath, 'src/pages/**/*.astro');
    console.info(`[UiModuleGenerator] Optimizing Hybrid Rendering. Scanning: ${pagesPattern}`);

    const astroFiles = await glob(pagesPattern);
    console.info(`[UiModuleGenerator] Found ${astroFiles.length} .astro files.`);

    for (const file of astroFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');

        // Naive but effective check for PageGuard usage
        if (content.includes('PageGuard.protect')) {
          // Check if already configured for SSR (prerender = false)
          if (!content.includes('export const prerender = false')) {
            console.info(
              `[UiModuleGenerator] Enhancing ${path.basename(file)} with SSR (prerender = false)`,
            );

            // Inject into frontmatter
            // Assumes standard Astro format:
            // ---
            // import ...
            // ---

            if (content.startsWith('---')) {
              const newContent = content.replace('---', '---\nexport const prerender = false;');
              fs.writeFileSync(file, newContent, 'utf-8');
            } else {
              // No frontmatter? (Rare for protected pages, but possible)
              const newContent = `---\nexport const prerender = false;\n---\n${content}`;
              fs.writeFileSync(file, newContent, 'utf-8');
            }
          }
        }
      } catch (e) {
        console.warn(`[UiModuleGenerator] Failed to optimize ${file}: ${e}`);
      }
    }
  }
}
