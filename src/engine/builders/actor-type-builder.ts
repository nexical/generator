import {
  type ModelDef,
  type FileDefinition,
  type ImportConfig,
  type NodeContainer,
  type StatementConfig,
} from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';

export class ActorTypeBuilder extends BaseBuilder {
  constructor(private models: ModelDef[]) {
    super();
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    // ... existing logic ...
    const actorModels = this.models.filter((m) => m.actor);

    const imports: ImportConfig[] = [];
    const statements: StatementConfig[] = [];

    const importsByModule: Record<string, string[]> = {};

    for (const model of actorModels) {
      const ms = './sdk/types.js';
      if (!importsByModule[ms]) importsByModule[ms] = [];
      importsByModule[ms].push(model.name);
    }

    for (const [ms, names] of Object.entries(importsByModule)) {
      imports.push({
        moduleSpecifier: ms,
        isTypeOnly: true,
        namedImports: [...new Set(names)],
      });
    }

    if (actorModels.length > 0) {
      const mapEntries = actorModels
        .map(
          (m: ModelDef) =>
            `${m.name.charAt(0).toLowerCase() + m.name.slice(1)}: ${m.name} & { type: '${
              m.name.charAt(0).toLowerCase() + m.name.slice(1)
            }' };`,
        )
        .join('\n      ');

      statements.push(TemplateLoader.load('actor/global-map.tsf', { mapEntries }));
    }

    return {
      imports: imports,
      statements: statements,
    };
  }

  public override ensure(node: NodeContainer): void {
    // Fully generated file, clear previous content to avoid duplication
    if ('removeText' in node) (node as unknown as { removeText(): void }).removeText();
    super.ensure(node);
  }
}
