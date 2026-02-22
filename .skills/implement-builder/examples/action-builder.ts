// .skills/implement-builder/examples/action-builder.ts

import { BaseBuilder } from '../base-builder.js';
import {
  FileDefinition,
  MethodDefinition,
  NodeContainer,
  ImportDefinition,
} from '../../types/index.js';
import { TemplateLoader } from '../../utils/template-loader.js';
import { StringUtils } from '../../utils/string-utils.js';

interface ActionBuilderConfig {
  actionName: string;
  moduleName: string;
}

export class ActionBuilder extends BaseBuilder {
  private config: ActionBuilderConfig;

  constructor(filePath: string, config: ActionBuilderConfig) {
    super(filePath);
    this.config = config;
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    return {
      imports: this.buildImports(node),
      class: {
        name: StringUtils.toPascalCase(this.config.actionName),
        extends: 'BaseAction',
        methods: [this.buildRunMethod(node)],
      },
    };
  }

  private buildImports(node?: NodeContainer): ImportDefinition[] {
    const imports: ImportDefinition[] = [
      { module: '@/lib/api/base-action', named: ['BaseAction'] },
      { module: '@/lib/api/context', named: ['APIContext'] },
    ];

    // Example of Smart Import Resolution
    if (this.needsPrisma(node)) {
      imports.push({ module: '@/lib/core/db', named: ['db'] });
    }

    return imports;
  }

  private needsPrisma(node?: NodeContainer): boolean {
    // If the user code (node) imports or uses 'db', we must ensure it is imported.
    return node?.source?.includes('db.') || false;
  }

  private buildRunMethod(node?: NodeContainer): MethodDefinition {
    const defaultBody = TemplateLoader.load('action/run.tsf', {
      actionName: this.config.actionName,
    });

    return {
      name: 'run',
      isAsync: true,
      isStatic: true,
      parameters: [
        { name: 'input', type: 'unknown' },
        { name: 'context', type: 'APIContext' },
      ],
      returnType: 'Promise<void>',
      body: node?.methods?.find((m) => m.name === 'run')?.body || defaultBody,
    };
  }
}
