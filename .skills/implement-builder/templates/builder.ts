// .skills/implement-builder/templates/builder.ts

import { BaseBuilder } from '../base-builder.js';
import {
  FileDefinition,
  ImportDefinition,
  MethodDefinition,
  NodeContainer,
} from '../../types/index.js';
import { TemplateLoader } from '../../utils/template-loader.js';

interface FeatureBuilderConfig {
  name: string;
}

export class FeatureBuilder extends BaseBuilder {
  private config: FeatureBuilderConfig;

  constructor(filePath: string, config: FeatureBuilderConfig) {
    super(filePath);
    this.config = config;
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    return {
      imports: this.buildImports(node),
      class: {
        name: this.config.name,
        methods: [this.buildMainMethod(node)],
      },
    };
  }

  private buildImports(node?: NodeContainer): ImportDefinition[] {
    const imports: ImportDefinition[] = [{ module: '@/lib/core', named: ['BaseService'] }];

    if (this.needsHelper(node)) {
      imports.push({ module: '@/utils/helper', named: ['Helper'] });
    }

    return imports;
  }

  private needsHelper(node?: NodeContainer): boolean {
    // Check if user code uses Helper or if we are generating default code that uses it
    return node?.source?.includes('Helper') || true;
  }

  private buildMainMethod(node?: NodeContainer): MethodDefinition {
    const defaultBody = TemplateLoader.load('feature/main.tsf', {
      name: this.config.name,
    });

    return {
      name: 'run',
      isAsync: true,
      isStatic: true,
      parameters: [{ name: 'input', type: 'unknown' }],
      returnType: 'Promise<void>',
      body: node?.methods?.find((m) => m.name === 'run')?.body || defaultBody,
    };
  }
}
