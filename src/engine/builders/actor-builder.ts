import {
  type ModelDef,
  type FileDefinition,
  type VariableConfig,
  type ImportConfig,
  type NodeContainer,
} from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';

export class ActorBuilder extends BaseBuilder {
  constructor(private models: ModelDef[]) {
    super();
  }

  public override ensure(node: NodeContainer): void {
    // Fully generated file, clear previous content to avoid duplication
    if ('removeText' in node) (node as unknown as { removeText(): void }).removeText();
    super.ensure(node);
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    const actorsBody: string[] = [];
    const imports: ImportConfig[] = [];

    let needsDb = false;
    let needsCrypto = false;

    for (const model of this.models) {
      console.info(`[ActorBuilder] Checking model: ${model.name}, hasActor: ${!!model.actor}`);
      if (!model.actor) continue;

      // Enable crypto if any actor uses hashing in bearer strategy (heuristic)
      if (model.actor.strategy === 'bearer') {
        const kf = model.actor.fields?.keyField || 'hashedKey';
        if (kf.includes('hash')) needsCrypto = true;
      }

      const config = model.actor;
      // e.g. "User" -> "user"
      const actorName = model.name.charAt(0).toLowerCase() + model.name.slice(1);

      let body = '';

      if (config.strategy === 'login') {
        const idField = config.fields?.identifier || 'email';
        const secretField = config.fields?.secret || 'password';

        body = TemplateLoader.load('actor/login.tsf', {
          secretField,
          modelName: model.name,
          actorName,
          idField,
        }).raw;
      } else if (config.strategy === 'api-key') {
        const keyModel = config.fields?.keyModel;
        const ownerField = config.fields?.ownerField;

        if (!keyModel || !ownerField) {
          continue;
        }

        needsDb = true;
        needsCrypto = true;

        const keyModelProp = keyModel.charAt(0).toLowerCase() + keyModel.slice(1);

        body = TemplateLoader.load('actor/api-key.tsf', {
          actorName,
          keyModelProp,
          ownerField,
        }).raw;
      } else if (config.strategy === 'bearer') {
        const tokenModel = config.fields?.tokenModel || model.name;
        const ownerField = config.fields?.ownerField;
        const keyField = config.fields?.keyField || 'hashedKey';
        const prefix = config.prefix || '';

        const tokenModelLocal = tokenModel.charAt(0).toLowerCase() + tokenModel.slice(1);

        const isExternalToken = tokenModel !== model.name;
        let relationFieldStr = '';

        if (isExternalToken) {
          const targetModelDef = this.models.find((m) => m.name === tokenModel);
          if (targetModelDef) {
            const relationEntry = Object.entries(targetModelDef.fields).find(
              ([_, f]) => f.type === model.name,
            );
            if (relationEntry) {
              const [relationName] = relationEntry;
              relationFieldStr = `${relationName}: { connect: { id: actor.id } },`;
            }
          }
          if (!relationFieldStr && ownerField) {
            const inferred = ownerField.replace('Id', '');
            const hasOnActor = model.fields[ownerField];
            const sourceId = hasOnActor ? `actor.${ownerField}` : `actor.id`;
            relationFieldStr = `${inferred}: { connect: { id: ${sourceId} } },`;
          }
        }

        const hashLogic = keyField.includes('hash')
          ? `dbKey = crypto.createHash('sha256').update(rawKey).digest('hex');`
          : '';

        body = TemplateLoader.load('actor/bearer.tsf', {
          actorName,
          prefix,
          tokenModelLocal,
          relationFieldStr,
          keyField,
          hashLogic,
        }).raw;
      }

      if (body) {
        actorsBody.push(`${actorName}: ${body}`);
      }
    }

    const actorsVariable: VariableConfig = {
      name: 'actors',
      declarationKind: 'const',
      isExported: true,
      initializer: `{
    ${actorsBody.join(',\n    ')}
}`,
    };

    if (actorsBody.length > 0) {
      imports.push({
        moduleSpecifier: '@tests/integration/lib/factory',
        namedImports: ['Factory'],
      });
      imports.push({
        moduleSpecifier: '@tests/integration/lib/client',
        isTypeOnly: true,
        namedImports: ['ApiClient'],
      });
    }

    if (needsDb) {
      imports.push({ moduleSpecifier: '@/lib/core/db', namedImports: ['db'] });
    }
    if (needsCrypto) {
      imports.push({ moduleSpecifier: 'node:crypto', defaultImport: 'crypto' });
    }

    return {
      imports: imports,
      variables: [actorsVariable],
    };
  }
}
