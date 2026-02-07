import {
  type ModelDef,
  type FileDefinition,
  type ImportConfig,
  type FunctionConfig,
  type CustomRoute,
  type StatementConfig,
} from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';
import { SourceFile, ModuleDeclaration } from 'ts-morph';
import { ts } from '../primitives/statements/factory.js';

export class MiddlewareBuilder extends BaseBuilder {
  constructor(
    private models: ModelDef[],
    private routes: CustomRoute[] = [],
  ) {
    super();
  }

  protected getSchema(node?: SourceFile | ModuleDeclaration): FileDefinition {
    const authLogic: StatementConfig[] = [];

    for (const model of this.models) {
      if (!model.actor || model.actor.prefix === undefined) continue;

      const { prefix, name } = model.actor;
      const modelName = model.name.charAt(0).toLowerCase() + model.name.slice(1);

      // Logic to check header and look up entity
      const tokenModel = model.actor.fields?.tokenModel || modelName;
      const keyField = model.actor.fields?.keyField || 'hashedKey';

      const needsHashing = keyField.includes('hash');
      const tokenValueVar = needsHashing ? 'hashedToken' : 'token';
      const hashLogic = needsHashing
        ? `const hashedToken = crypto.createHash('sha256').update(token).digest('hex');`
        : '';

      let relationField = '';
      if (tokenModel !== modelName) {
        const tokenModelDef = this.models.find((m) => m.name === tokenModel);
        if (tokenModelDef) {
          const relationEntry = Object.entries(tokenModelDef.fields).find(
            ([_, f]) => f.type === model.name,
          );
          if (relationEntry) {
            relationField = relationEntry[0];
          }
        }
        if (!relationField) {
          relationField = modelName.toLowerCase();
        }
      }

      const includeClause = relationField ? `, \n    include: { ${relationField}: true }` : '';
      const assignment = relationField
        ? `const entity = tokenEntity?.${relationField};`
        : `const entity = tokenEntity;`;

      const lookupLogic = TemplateLoader.load('middleware/lookup.tsf', {
        hashLogic,
        dbModel: tokenModel.charAt(0).toLowerCase() + tokenModel.slice(1),
        keyField,
        tokenValueVar,
        includeClause,
        assignment,
      });

      authLogic.push(
        TemplateLoader.load('middleware/auth.tsf', {
          prefix,
          lookupLogic: lookupLogic.raw,
          name: name || modelName,
          role: (name || modelName).toUpperCase(),
        }),
      );
    }

    const imports: ImportConfig[] = [
      {
        moduleSpecifier: 'astro',
        namedImports: ['APIContext', 'MiddlewareNext'],
        isTypeOnly: true,
      },
    ];

    const hasActors = this.models.some((m) => m.actor && m.actor.prefix);
    const hasAuthLogic = authLogic.length > 0;

    if (hasActors && hasAuthLogic) {
      imports.push({ moduleSpecifier: '@/lib/core/db', namedImports: ['db'] });
      imports.push({ moduleSpecifier: 'node:crypto', defaultImport: 'crypto' });
    }

    // Scan for actor with validStatus or login strategy to implement Bouncer Pattern
    let sessionCheck: StatementConfig | null = null;

    const loginActorModel = this.models.find(
      (m) => m.actor?.validStatus || m.actor?.strategy === 'login',
    );

    // Session Hydration Logic
    // Session Hydration - REMOVED per user request
    if (loginActorModel) {
      // Only keeping this block if other logic needs loginActorModel, but strictly removing session check
      sessionCheck = null;
    }

    // Dynamic Bouncer Pattern
    let bouncerCheck: StatementConfig = ts`if (context.locals.actor) return next();`;

    // If we have a login actor, check for status field
    if (loginActorModel && loginActorModel.fields['status']) {
      const modelName =
        loginActorModel.name.charAt(0).toLowerCase() + loginActorModel.name.slice(1);

      // Determine check condition: White-list (strict) or Black-list (legacy)
      const validStatus = loginActorModel.actor?.validStatus;
      const statusCheck = validStatus
        ? `!actorCheck || actorCheck.status !== '${validStatus}'`
        : `!actorCheck || actorCheck.status === 'BANNED' || actorCheck.status === 'INACTIVE'`;

      bouncerCheck = TemplateLoader.load('middleware/bouncer.tsf', {
        modelName,
        statusCheck,
      });
    }

    const onRequest: FunctionConfig = {
      name: 'onRequest',
      isAsync: true,
      overwriteBody: true,
      isExported: true,
      parameters: [
        { name: 'context', type: 'APIContext' },
        { name: 'next', type: 'MiddlewareNext' },
      ],
      statements: [
        ts`const publicRoutes = [${this.routes
          .filter((r) => r.role === 'anonymous')
          .map((r) => `"/${r.path.replace(/^\//, '')}"`)
          .join(', ')}];`,
        ts`if (publicRoutes.some(route => context.url.pathname.startsWith(route))) return next();`,
        hasAuthLogic ? ts`const authHeader = context.request.headers.get("Authorization");` : null,
        ...authLogic,
        ts`// Session Hydration`,
        sessionCheck,
        ts`// Dynamic Bouncer Pattern: Validate Actor Status`,
        bouncerCheck,
        ts`return next();`,
      ].filter(Boolean) as StatementConfig[],
    };

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports,
      functions: [onRequest],
      statements: [ts`export default { onRequest };`],
    };
  }
}
