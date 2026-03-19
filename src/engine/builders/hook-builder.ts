import { Project, SourceFile } from 'ts-morph';
import { BaseBuilder } from './base-builder.js';
import { type FileDefinition, type ModuleConfig } from '../types.js';
import { Reconciler } from '../reconciler.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { HookUnitTestBuilder } from './test/unit/hook-unit-test-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';

export interface HookTemplateConfig {
  event: string;
  action: string;
  filter?: boolean;
}

export interface HooksConfig {
  hooks: HookTemplateConfig[];
}

export class HookBuilder extends BaseBuilder {
  private hooksConfig: HooksConfig = { hooks: [] };

  constructor(
    protected moduleName: string,
    protected config: ModuleConfig,
  ) {
    super();
  }

  async build(project: Project, sourceFile: SourceFile | undefined): Promise<void> {
    this.loadHooksConfig();
    if (this.hooksConfig.hooks.length === 0) return;

    // Group hooks by action name for files, or just one file per hook?
    // One file per hook is easier for the glob pattern in server-init.ts
    for (const hook of this.hooksConfig.hooks) {
      this.generateHookFile(project, hook);
    }
  }

  private loadHooksConfig() {
    const configPath = join(process.cwd(), 'modules', this.moduleName, 'hooks.yaml');
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf8');
        this.hooksConfig = parse(content) || { hooks: [] };
      } catch {
        console.warn(`[HookBuilder] Failed to parse hooks.yaml for ${this.moduleName}`);
      }
    }
  }

  private generateHookFile(project: Project, hook: HookTemplateConfig) {
    const fileName = `src/hooks/${hook.event.replace(/\./g, '-')}-${hook.action.replace(/\./g, '-')}.ts`;
    const file =
      project.getSourceFile(fileName) ||
      project.createSourceFile(fileName, '', { overwrite: true });

    const method = hook.filter ? 'filter' : 'on';

    const existingImports = this.getExistingImports(file);
    const imports: import('../types.js').ImportConfig[] = [
      {
        moduleSpecifier: '@/lib/modules/hooks',
        namedImports: ['HookSystem'],
      },
      ...existingImports.filter((imp) => imp.moduleSpecifier !== '@/lib/modules/hooks'),
    ];

    const definition: FileDefinition = {
      header: this.getHeader(),
      imports,
      functions: [
        {
          name: 'init',
          isExported: true,
          isAsync: true,
          statements: [
            TemplateLoader.load('hooks/init.tsf', {
              method,
              event: hook.event,
              action: hook.action,
            }),
          ],
        },
      ],
    };

    Reconciler.reconcile(file, definition);

    // Generate unit test
    const testFileName = `tests/unit/hooks/${hook.event.replace(/\./g, '-')}-${hook.action.replace(/\./g, '-')}.test.ts`;
    const testFile = project.createSourceFile(testFileName, '', { overwrite: true });
    new HookUnitTestBuilder(
      `${hook.event}-${hook.action}`,
      `../../../src/hooks/${hook.event.replace(/\./g, '-')}-${hook.action.replace(/\./g, '-')}`,
    ).ensure(testFile);
  }

  private getHeader(): string {
    return '// GENERATED CODE - THE SIGNATURE IS MANAGED BY THE GENERATOR. YOU MAY MODIFY THE IMPLEMENTATION AND ADD CUSTOM IMPORTS.';
  }

  protected getSchema(): FileDefinition {
    throw new Error('HookBuilder manages multiple files. Use build().');
  }
}
