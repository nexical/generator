import { Project, SourceFile } from 'ts-morph';
import { BaseBuilder } from './base-builder.js';
import {
  type FileDefinition,
  type ModuleConfig,
  type PropertyConfig,
  type MethodConfig,
  type ConstructorConfig,
} from '../types.js';
import { Reconciler } from '../reconciler.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { toPascalCase } from '../../utils/string.js';
import { ts } from '../primitives/statements/factory.js';

export interface AgentTemplateConfig {
  name: string;
  type: 'job' | 'persistent';
  payload?: Record<string, string>;
  interval?: number;
}

export interface AgentsConfig {
  agents: AgentTemplateConfig[];
}

export class AgentBuilder extends BaseBuilder {
  private agentsConfig: AgentsConfig = { agents: [] };

  constructor(
    protected moduleName: string,
    protected config: ModuleConfig,
  ) {
    super();
  }

  async build(project: Project, sourceFile: SourceFile | undefined): Promise<void> {
    this.loadAgentsConfig();
    if (this.agentsConfig.agents.length === 0) return;

    for (const agent of this.agentsConfig.agents) {
      this.generateAgentFile(project, agent);
    }
  }

  private loadAgentsConfig() {
    const configPath = join(process.cwd(), 'modules', this.moduleName, 'agents.yaml');
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf8');
        this.agentsConfig = parse(content) as AgentsConfig;
      } catch {
        console.warn(`[AgentBuilder] Failed to parse agents.yaml for ${this.moduleName}`);
      }
    }
  }

  private generateAgentFile(project: Project, agent: AgentTemplateConfig) {
    const fileName = `src/agent/${toPascalCase(agent.name)}.ts`;
    const file = project.createSourceFile(fileName, '', { overwrite: true });

    const isJob = agent.type === 'job';
    const baseClass = isJob ? 'JobProcessor' : 'PersistentAgent';
    const importPath = isJob
      ? '@nexical/agent/src/core/processor.js'
      : '@nexical/agent/src/core/persistent.js';

    const imports = [
      {
        moduleSpecifier: importPath,
        namedImports: isJob ? [baseClass, 'ProcessorConfig', 'AgentJob'] : [baseClass],
      },
    ];

    if (isJob) {
      imports.push({
        moduleSpecifier: 'zod',
        namedImports: ['z'],
      });
    }

    const definition: FileDefinition = {
      header: this.getHeader(),
      imports,
      classes: [
        {
          name: toPascalCase(agent.name),
          isExported: true,
          extends: isJob ? `${baseClass}<unknown>` : baseClass,
          properties: this.generateProperties(agent),
          methods: this.generateMethods(agent),
          constructorDef: isJob ? this.generateConstructor() : undefined,
        },
      ],
    };

    Reconciler.reconcile(file, definition);
  }

  private generateProperties(agent: AgentTemplateConfig): PropertyConfig[] {
    const props: PropertyConfig[] = [];
    if (agent.type === 'job') {
      props.push({
        name: 'jobType',
        type: 'string', // Added missing type
        isStatic: true,
        initializer: `'${agent.name}'`,
      });
      props.push({
        name: 'schema',
        type: 'any', // Keep as any here if ZodSchema is complex to type in generator
        initializer: `z.object({
${Object.entries(agent.payload || {})
  .map(([name, type]) => `    ${name}: z.${type}(),`)
  .join('\n')}
})`,
      });
    } else {
      props.push({
        name: 'interval',
        type: 'number', // Added missing type
        initializer: (agent.interval || 60000).toString(),
      });
    }
    return props;
  }

  private generateMethods(agent: AgentTemplateConfig): MethodConfig[] {
    if (agent.type === 'job') {
      return [
        {
          name: 'process',
          isAsync: true,
          parameters: [{ name: 'job', type: 'AgentJob<unknown>' }],
          statements: [
            ts`const { ${Object.keys(agent.payload || {}).join(', ')} } = job.payload;`,
            ts`console.info(\`[${agent.name}] Processing job \${job.id}\`);`,
            ts`// TODO: Implement processing logic`,
          ],
        },
      ];
    } else {
      return [
        {
          name: 'run',
          isAsync: true,
          statements: [
            ts`console.info(\`[${agent.name}] Running persistent agent task\`);`,
            ts`// TODO: Implement periodic task logic`,
          ],
        },
      ];
    }
  }

  private generateConstructor(): ConstructorConfig {
    return {
      parameters: [{ name: 'config', type: 'ProcessorConfig' }],
      statements: [ts`super(config);`],
    };
  }

  private getHeader(): string {
    return '// GENERATED CODE - DO NOT MODIFY';
  }

  protected getSchema(): FileDefinition {
    throw new Error('AgentBuilder manages multiple files. Use build().');
  }
}
