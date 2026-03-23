import {
  type ModelDef,
  type FileDefinition,
  type TestRoleConfig,
  type ImportConfig,
  type NodeContainer,
} from '../../../types.js';
import { BaseBuilder } from '../../base-builder.js';
import { TemplateLoader } from '../../../../utils/template-loader.js';
import { ts } from '../../../primitives/statements/factory.js';
import { PathResolver } from '../../../../utils/path-resolver.js';

type TestOperation = 'create' | 'list' | 'get' | 'update' | 'delete';

export class IntegrationTestBuilder extends BaseBuilder {
  constructor(
    private model: ModelDef,
    private allModels: ModelDef[],
    private moduleName: string,
    private operation: TestOperation,
    private roleConfig: TestRoleConfig = {},
  ) {
    super();
  }

  private getRole(operation: string): string {
    if (!this.model.role) return 'member';
    if (typeof this.model.role === 'string') return this.model.role;
    if (typeof this.model.role === 'object' && this.model.role !== null) {
      return this.model.role[operation] || 'member';
    }
    return 'member';
  }

  private getTestActorModelName(): string {
    const defaults = PathResolver.getDefaults();
    return this.model.test?.actor || defaults.defaultRole.toLowerCase().replace('user_', '');
  }

  private getActorRelationSnippet(isUsed: boolean = true): string {
    const actorName = this.getTestActorModelName();
    const actorVar = isUsed ? 'actor' : '_actor';

    // Skip self-referential links (e.g. Team acting on Team)
    if ((this.model.name || '').toLowerCase() === actorName.toLowerCase()) {
      return '';
    }

    const actorVal = `(${actorVar} ? (${actorVar} as unknown as { id: string }).id : undefined)`;

    for (const [name, field] of Object.entries(this.model.fields)) {
      // Check if field type matches actor name (case insensitive)
      if (field.type && field.type.toLowerCase() === actorName.toLowerCase()) {
        return `, ${name}: { connect: { id: ${actorVal} } }`;
      }
    }

    const defaults = PathResolver.getDefaults();
    const defaultActor = defaults.defaultRole.toLowerCase().replace('user_', '');

    // Loose coupling: check for actorId or userId
    if (this.model.fields['actorId']) return `, actorId: ${actorVal}, actorType: '${actorName}'`;
    if (
      this.model.fields['userId'] &&
      (actorName.toLowerCase() === defaultActor || actorName.toLowerCase() === 'user')
    )
      return `, userId: ${actorVal}`;

    return '';
  }

  private getActorStatement(operation: string, isUsed: boolean = false): string {
    const requiredRole = this.getRole(operation).toUpperCase();
    const actorName = this.model.test?.actor || 'user';
    const actorVar = isUsed ? 'actor' : '_actor';

    if (requiredRole === 'PUBLIC' || requiredRole === 'NONE') {
      return `// Public access - no auth required\n    const ${actorVar} = undefined as unknown;`;
    }

    // Check config for direct key match
    if (this.roleConfig[requiredRole]) {
      const optsArray = JSON.stringify(this.roleConfig[requiredRole])
        .replace(/"([^"]+)":/g, '$1:')
        .replace(/"/g, "'");
      return `const ${actorVar} = await client.as('${actorName}', ${optsArray});`;
    }

    // Check config for matching role value
    for (const [_key, val] of Object.entries(this.roleConfig)) {
      if (val.role === requiredRole) {
        const optsArray = JSON.stringify(val)
          .replace(/"([^"]+)":/g, '$1:')
          .replace(/"/g, "'");
        return `const ${actorVar} = await client.as('${actorName}', ${optsArray});`;
      }
    }

    // Special case for legacy 'member' or 'admin' strings if they are used as requiredRole
    if (requiredRole === 'ADMIN' && this.roleConfig['admin']) {
      const optsArray = JSON.stringify(this.roleConfig['admin'])
        .replace(/"([^"]+)":/g, '$1:')
        .replace(/"/g, "'");
      return `const ${actorVar} = await client.as('${actorName}', ${optsArray});`;
    }

    // Fallback
    return `const ${actorVar} = await client.as('${actorName}', {});`;
  }

  private getNegativeActorStatement(operation: TestOperation, isUsed: boolean = false): string {
    const actorVar = isUsed ? 'actor' : '_actor';
    return `client.useToken('invalid-token');
            const ${actorVar} = undefined as unknown;`;
  }

  private getUniqueFields(): string[] {
    const uniques: string[] = [];

    // Always treat email, username and token as unique-ish for tests to avoid collisions
    if (this.model.fields['email']) uniques.push('email');
    if (this.model.fields['username']) uniques.push('username');
    if (this.model.fields['token']) uniques.push('token');

    for (const [name, field] of Object.entries(this.model.fields)) {
      if (uniques.includes(name)) continue;
      if (field.type === 'String' && field.attributes?.some((a) => a.includes('@unique'))) {
        uniques.push(name);
      }
    }
    return uniques;
  }

  private isForeignKey(fieldName: string): boolean {
    for (const otherField of Object.values(this.model.fields)) {
      if (otherField.isRelation && otherField.attributes) {
        const relationAttr = otherField.attributes.find((a) => a.startsWith('@relation'));
        if (relationAttr) {
          const match = relationAttr.match(/fields:\s*\[([^\]]+)\]/);
          if (match) {
            const fields = match[1].split(',').map((f) => f.trim());
            if (fields.includes(fieldName)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    const entityName = this.model.name || 'Unknown';
    const camelEntity = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    const kebabEntity = entityName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();

    // Generate mock data based on fields
    const mockData = this.generateMockData();
    const updateData = this.generateUpdateData();

    let testBody = '';

    switch (this.operation) {
      case 'create':
        testBody = this.generateCreateTests(kebabEntity, camelEntity, mockData);
        break;
      case 'list':
        testBody = this.generateListTests(kebabEntity, camelEntity, mockData);
        break;
      case 'get':
        testBody = this.generateGetTests(kebabEntity, camelEntity, mockData);
        break;
      case 'update':
        testBody = this.generateUpdateTests(kebabEntity, camelEntity, mockData, updateData);
        break;
      case 'delete':
        testBody = this.generateDeleteTests(kebabEntity, camelEntity, mockData);
        break;
    }

    const imports = [
      { moduleSpecifier: 'vitest', namedImports: ['describe', 'it', 'expect', 'beforeEach'] },
      { moduleSpecifier: '@tests/integration/lib/client', namedImports: ['ApiClient'] },
      { moduleSpecifier: '@tests/integration/lib/server', namedImports: ['TestServer'] },
    ];

    if (testBody.includes('Factory')) {
      imports.push({
        moduleSpecifier: '@tests/integration/lib/factory',
        namedImports: ['Factory'],
      });
    }

    // Preserve existing manual imports
    const existingImports = this.getExistingImports(node);
    const importMap = new Map<string, ImportConfig>();

    // Add generated imports first
    imports.forEach((imp) => importMap.set(imp.moduleSpecifier, imp));

    // Add existing imports if not already present or merge named imports
    existingImports.forEach((existing) => {
      const existingSpecifier = existing.moduleSpecifier;
      if (importMap.has(existingSpecifier)) {
        const generated = importMap.get(existingSpecifier)!;
        if (existing.namedImports && generated.namedImports) {
          const mergedNames = [...new Set([...generated.namedImports, ...existing.namedImports])];
          generated.namedImports = mergedNames;
          generated.isTypeOnly = generated.isTypeOnly && existing.isTypeOnly;
        }
      } else {
        importMap.set(existingSpecifier, existing);
      }
    });

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports: Array.from(importMap.values()),
      variables: [],
      statements: [
        ts`describe('${entityName} API - ${(this.operation || 'unknown').charAt(0).toUpperCase() + (this.operation || '').slice(1)}', () => {
    let client: ApiClient;

    beforeEach(async () => {
        client = new ApiClient(TestServer.getUrl());
    });

    ${testBody}
})`,
      ],
    };
  }

  private getActorRelationFieldName(): string | null {
    const actorName = this.getTestActorModelName();
    if (this.model.fields['actorId']) return 'actorId';
    if (this.model.fields['userId'] && actorName.toLowerCase() === 'user') return 'userId';

    const scalarFK = this.findActorForeignKey();
    if (scalarFK) return scalarFK;

    for (const [name, field] of Object.entries(this.model.fields)) {
      if (field.type && field.type.toLowerCase() === actorName.toLowerCase()) {
        return name;
      }
    }

    return null;
  }

  private getRequiredForeignKeys(): { field: string; model: string }[] {
    const requiredFKs: { field: string; model: string }[] = [];
    const actorRelationField = this.getActorRelationFieldName();

    for (const [name, field] of Object.entries(this.model.fields)) {
      if (field.isRelation && field.attributes) {
        const relationAttr = field.attributes.find((a) => a.startsWith('@relation'));
        if (relationAttr) {
          const match = relationAttr.match(/fields:\s*\[([^\]]+)\]/);
          if (match) {
            const scalars = match[1].split(',').map((f) => f.trim());
            for (const scalarName of scalars) {
              if (
                actorRelationField &&
                (scalarName === actorRelationField || name === actorRelationField)
              ) {
                continue;
              }

              const scalarField = this.model.fields[scalarName];
              if (scalarField && scalarField.isRequired) {
                requiredFKs.push({ field: scalarName, model: field.type });
              }
            }
          }
        }
      }
    }
    return requiredFKs;
  }

  private generateCreateTests(
    kebabEntity: string,
    camelEntity: string,
    mockData: Record<string, unknown>,
  ): string {
    const requiredFKs = this.getRequiredForeignKeys();
    const actorRelationField = this.getActorRelationFieldName();

    let dependencySetup = '';
    let payloadConstruction = `const payload = ${this.stringifyObject(mockData, true)};`;

    const isActorUsed =
      requiredFKs.some((fk) => {
        const targetModel = this.allModels.find((m) => m.name === fk.model);
        return targetModel?.traits?.includes('actor-linked');
      }) || !!actorRelationField;

    const actorVar = isActorUsed ? 'actor' : '_actor';
    const actorStatement = this.getActorStatement('create', isActorUsed);

    if (requiredFKs.length > 0 || actorRelationField) {
      const setups = requiredFKs.map((fk, i) => {
        const modelName = fk.model || 'Unknown';
        const varName = `${modelName.charAt(0).toLowerCase() + modelName.slice(1)}_${i}`;
        const targetModel = this.allModels.find((m) => m.name === fk.model);
        const isActorLinked = targetModel?.traits?.includes('actor-linked');

        const actorVal = `(${actorVar} ? (${actorVar} as unknown as { id: string }).id : undefined)`;
        const extras = isActorLinked
          ? `, actorId: ${actorVal}, actorType: '${this.getTestActorModelName()}'`
          : '';
        return `const ${varName} = await Factory.create('${modelName.charAt(0).toLowerCase() + modelName.slice(1)}', { ${extras.replace(/^, /, '')} });`;
      });
      dependencySetup = setups.join('\n            ');

      const overrides = requiredFKs.map((fk, i) => {
        const modelName = fk.model || 'Unknown';
        const varName = `${modelName.charAt(0).toLowerCase() + modelName.slice(1)}_${i}`;
        return `${fk.field}: ${varName}.id`;
      });

      if (actorRelationField) {
        const actorVal = `(${actorVar} ? (${actorVar} as unknown as { id: string }).id : undefined)`;
        overrides.push(`${actorRelationField}: ${actorVal}`);
      }

      const overridesString = overrides.join(',\n                ');

      payloadConstruction = `const payload = {
                ...${this.stringifyObject(mockData)},
                ${overridesString}
            };`;
    }

    const assertionBlock = Object.keys(mockData)
      .filter((k) => k !== 'id')
      .map((k) => {
        const field = this.model.fields[k];
        if (field && field.type === 'DateTime') {
          return `expect(res.body.data.${k}).toBe(payload.${k}); // API returns ISO string`;
        }
        if (field && (field.isList || field.type === 'Json')) {
          return `expect(res.body.data.${k}).toStrictEqual(payload.${k});`;
        }
        return `expect(res.body.data.${k}).toBe(payload.${k});`;
      })
      .join('\n    ');

    const negativeActorStatement = this.getNegativeActorStatement('create', isActorUsed);

    return TemplateLoader.load('test/create.tsf', {
      kebabEntity,
      camelEntity,
      role: this.getRole('create'),
      actorStatement,
      dependencySetup,
      payloadConstruction,
      assertionBlock,
      negativeActorStatement,
    }).raw;
  }

  private findActorForeignKey(): string | null {
    const actorName = this.getTestActorModelName();
    for (const [name, field] of Object.entries(this.model.fields)) {
      if (field.type && field.type.toLowerCase() === actorName.toLowerCase()) {
        if (field.attributes) {
          const relationAttr = field.attributes.find((a) => a.startsWith('@relation'));
          if (relationAttr) {
            const match = relationAttr.match(/fields:\s*\[([^\]]+)\]/);
            if (match) {
              return match[1].split(',')[0].trim();
            }
          }
        }
        if (this.model.fields[`${name} Id`]) return `${name} Id`;
      }
    }
    return null;
  }

  private generateListTests(
    kebabEntity: string,
    camelEntity: string,
    mockData: Record<string, unknown>,
  ): string {
    const actorModelName = this.getTestActorModelName();
    const isActorModel = (this.model.name || '').toLowerCase() === actorModelName.toLowerCase();
    const actorFK = this.findActorForeignKey();

    const baseDataConfig = JSON.stringify(mockData).replace(
      /"__DATE_NOW__"/g,
      'new Date().toISOString()',
    );

    const filterTests = Object.keys(this.model.fields)
      .filter((f) => {
        const type = this.model.fields[f].type;
        return (
          !['id', 'createdAt', 'updatedAt', 'actorId', 'userId', 'actorType'].includes(f) &&
          ['String', 'Boolean', 'Int', 'Float', 'Decimal', 'DateTime'].includes(type) &&
          this.model.fields[f].api !== false &&
          !this.model.fields[f].private &&
          !this.model.fields[f].isList &&
          !this.isForeignKey(f)
        );
      })
      .map((field) => {
        const type = this.model.fields[field].type;
        const uniques = this.getUniqueFields();
        let uniqueInjectionA = '';
        let uniqueInjectionB = '';

        for (const u of uniques) {
          if (u === field) continue;
          const s = u === 'email' ? '@example.com' : '';
          uniqueInjectionA += `, ${u}: 'filter_a_' + Date.now() + '${s}'`;
          uniqueInjectionB += `, ${u}: 'filter_b_' + Date.now() + '${s}'`;
        }

        let val1Str = '';
        let val2Str = '';
        let assertion1 = '';

        if (type === 'String') {
          val1Str = `'${field}_' + Date.now() + '_A${field === 'email' ? '@example.com' : ''}'`;
          val2Str = `'${field}_' + Date.now() + '_B${field === 'email' ? '@example.com' : ''}'`;
          assertion1 = `expect(res.body.data[0].${field}).toBe(val1);`;
        } else if (type === 'Boolean') {
          val1Str = `true`;
          val2Str = `false`;
          assertion1 = `expect(res.body.data[0].${field}).toBe(val1);`;
        } else if (type === 'Int') {
          val1Str = `Date.now() % 1000`;
          val2Str = `(Date.now() % 1000) + 1`;
          assertion1 = `expect(res.body.data[0].${field}).toBe(val1);`;
        } else if (type === 'Float' || type === 'Decimal') {
          val1Str = `(Date.now() % 1000) + 0.5`;
          val2Str = `(Date.now() % 1000) + 1.5`;
          assertion1 = `expect(res.body.data[0].${field}).toBe(val1);`;
        } else if (type === 'DateTime') {
          val1Str = `new Date(Date.now() - 100000).toISOString()`;
          val2Str = `new Date(Date.now() + 100000).toISOString()`;
          assertion1 = `expect(res.body.data[0].${field}).toBe(val1);`;
        }

        const isActorUsedForFilter = !!this.getActorRelationSnippet(true);
        // Note: Template literal inside loop string generation
        return TemplateLoader.load('test/shared/filter-test.tsf', {
          field,
          actorStatement: this.getActorStatement('list', isActorUsedForFilter),
          camelEntity,
          kebabEntity,
          val1Str,
          val2Str,
          uniqueInjectionA,
          uniqueInjectionB,
          assertion1,
          actorRelationSnippet: this.getActorRelationSnippet(isActorUsedForFilter),
        }).raw;
      })
      .join('\n');

    const isAuthResource = ['token', 'key', 'session'].some((k) =>
      camelEntity.toLowerCase().includes(k),
    );
    const shouldPreserve = isActorModel || (isAuthResource && !!this.findActorForeignKey());

    let cleanupClause = '';
    if (shouldPreserve) {
      const actorVarCleanup = shouldPreserve ? 'actor' : '_actor';
      if (isActorModel) {
        cleanupClause = `await Factory.prisma.${camelEntity}.deleteMany({ where: { id: { not: ${actorVarCleanup}.id } } }); `;
      } else {
        cleanupClause = `await Factory.prisma.${camelEntity}.deleteMany({ where: { ${actorFK}: { not: ${actorVarCleanup}.id } } }); `;
      }
    } else {
      cleanupClause = `await Factory.prisma.${camelEntity}.deleteMany(); `;
    }

    const isActorUsed =
      shouldPreserve || !!this.getActorRelationSnippet(true) || !!this.getActorRelationFieldName();
    const actorStatement = this.getActorStatement('list', isActorUsed);
    const actorStatementNeg = this.getActorStatement('list', false);

    const seedClause = (() => {
      const uniques = this.getUniqueFields();
      const rel = this.getActorRelationSnippet(isActorUsed);
      if (uniques.length > 0) {
        const randomization1 = uniques
          .map((u) => {
            const s = u === 'email' ? '@example.com' : '';
            return `${u}: 'list_1_' + _listSuffix + '${s}'`;
          })
          .join(', ');
        const randomization2 = uniques
          .map((u) => {
            const s = u === 'email' ? '@example.com' : '';
            return `${u}: 'list_2_' + _listSuffix + '${s}'`;
          })
          .join(', ');
        return `await Factory.create('${camelEntity}', { ...baseData, ${randomization1}${rel} });
             await Factory.create('${camelEntity}', { ...baseData, ${randomization2}${rel} });`;
      }
      return `await Factory.create('${camelEntity}', { ...baseData${rel} });
             await Factory.create('${camelEntity}', { ...baseData${rel} });`;
    })();

    // Pagination Seed Logic
    const isActorUsedInPagination = shouldPreserve;
    const actorVarPagination = isActorUsedInPagination ? 'actor' : '_actor';

    const field = isActorModel ? 'id' : this.findActorForeignKey() || 'userId';
    const currentCountLogic = cleanupClause.includes('where')
      ? `currentCount = await Factory.prisma.${camelEntity}.count({ where: { ${field}: ${actorVarPagination} ? (${actorVarPagination} as unknown as { id: string }).id : undefined } });`
      : '';

    const loopBody = (() => {
      const uniques = this.getUniqueFields();
      const rel = this.getActorRelationSnippet(isActorUsedInPagination);
      if (uniques.length > 0) {
        const randomization = uniques
          .map((u) => {
            const s = u === 'email' ? '@example.com' : '';
            return `${u}: \`page_\${i}_\${_listSuffix}${s}\``;
          })
          .join(', ');
        return `const rec = await Factory.create('${camelEntity}', { ...baseData, ${randomization}${rel} });
                            createdIds.push(rec.id);`;
      }
      return `const rec = await Factory.create('${camelEntity}', { ...baseData${rel} });
                        createdIds.push(rec.id);`;
    })();

    const paginationSeedClause = `
    const _listSuffix = Date.now();
    ${currentCountLogic ? `let currentCount = 0;\n    ${currentCountLogic}` : 'const currentCount = 0;'}
    const toCreate = totalTarget - currentCount;

    for (let i = 0; i < toCreate; i++) {
        ${loopBody}
    }
    `;

    const actorStatementPagination = this.getActorStatement('list', isActorUsedInPagination);

    return TemplateLoader.load('test/list.tsf', {
      kebabEntity,
      camelEntity,
      role: this.getRole('list'),
      actorStatement,
      actorStatementPagination,
      actorStatementNeg,
      cleanupClause,
      seedClause,
      paginationSeedClause,
      filterTests,
      baseDataConfig,
    }).raw;
  }

  private generateGetTests(
    kebabEntity: string,
    camelEntity: string,
    mockData: Record<string, unknown>,
  ): string {
    const isActorModel =
      (this.model.name || '').toLowerCase() === this.getTestActorModelName().toLowerCase();

    const requiredFKs = this.getRequiredForeignKeys();
    let dependencySetup = '';
    let overrides = '';

    const isActorUsed = isActorModel || !!this.getActorRelationSnippet(true);
    const actorVar = isActorUsed ? 'actor' : '_actor';
    const actorStatement = this.getActorStatement('get', isActorUsed);
    const actorStatementNeg = this.getActorStatement('get', false);

    if (!isActorModel && requiredFKs.length > 0) {
      const setups = requiredFKs.map((fk, i) => {
        const modelName = fk.model || 'Unknown';
        const varName = `${modelName.charAt(0).toLowerCase() + modelName.slice(1)}_${i} `;
        const targetModel = this.allModels.find((m) => m.name === fk.model);
        const isActorLinked = targetModel?.traits?.includes('actor-linked');

        const extras = isActorLinked
          ? `, actorId: (${actorVar} ? (${actorVar} as unknown as { id: string }).id : undefined), actorType: '${this.getTestActorModelName()}'`
          : '';
        return `const ${varName} = await Factory.create('${modelName.charAt(0).toLowerCase() + modelName.slice(1)}', { ${extras.replace(/^, /, '')}}); `;
      });
      dependencySetup = setups.join('\n            ');

      overrides = requiredFKs
        .map((fk, i) => {
          const modelName = fk.model || 'Unknown';
          const varName = `${modelName.charAt(0).toLowerCase() + modelName.slice(1)}_${i} `;
          const relationName = fk.field.endsWith('Id') ? fk.field.slice(0, -2) : fk.field;
          return `${relationName}: { connect: { id: ${varName}.id } } `;
        })
        .join(', ');
      if (overrides) overrides = `, ${overrides} `;
    }

    let setupSnippet = '';
    if (isActorModel) {
      setupSnippet = `const target = ${actorVar}; `;
    } else {
      setupSnippet = `
            ${dependencySetup}
const target = await Factory.create('${camelEntity}', { ...${JSON.stringify(mockData).replace(/"__DATE_NOW__"/g, 'new Date().toISOString()')}${this.getActorRelationSnippet(isActorUsed)}${overrides} }); `;
    }

    return TemplateLoader.load('test/get.tsf', {
      kebabEntity,
      camelEntity,
      actorStatement,
      actorStatementNeg,
      setupSnippet,
    }).raw;
  }

  private generateUpdateTests(
    kebabEntity: string,
    camelEntity: string,
    mockData: Record<string, unknown>,
    updateData: Record<string, unknown>,
  ): string {
    const isActorModel =
      (this.model.name || '').toLowerCase() === this.getTestActorModelName().toLowerCase();

    const requiredFKs = this.getRequiredForeignKeys();
    const actorRelationField = this.getActorRelationFieldName();
    let dependencySetup = '';
    let overrides = '';

    const isActorUsed =
      isActorModel ||
      requiredFKs.some((fk) => {
        const targetModel = this.allModels.find((m) => m.name === fk.model);
        return targetModel?.traits?.includes('actor-linked');
      }) ||
      !!this.getActorRelationSnippet(true);

    const actorVar = isActorUsed ? 'actor' : '_actor';
    const actorStatement = this.getActorStatement('update', isActorUsed);

    if (!isActorModel && requiredFKs.length > 0) {
      const setups = requiredFKs.map((fk, i) => {
        const modelName = fk.model || 'Unknown';
        const varName = `${modelName.charAt(0).toLowerCase() + modelName.slice(1)}_${i}`;
        const targetModel = this.allModels.find((m) => m.name === fk.model);
        const isActorLinked = targetModel?.traits?.includes('actor-linked');
        const extras = isActorLinked
          ? `, actorId: (${actorVar} ? (${actorVar} as unknown as { id: string }).id : undefined), actorType: '${this.getTestActorModelName()}'`
          : '';
        return `const ${varName} = await Factory.create('${modelName.charAt(0).toLowerCase() + modelName.slice(1)}', {${extras.replace(/^, /, '')}});`;
      });
      dependencySetup = setups.join('\n            ');

      overrides = requiredFKs
        .map((fk, i) => {
          const modelName = fk.model || 'Unknown';
          const varName = `${modelName.charAt(0).toLowerCase() + modelName.slice(1)}_${i}`;
          const relationName = fk.field.endsWith('Id') ? fk.field.slice(0, -2) : fk.field;
          return `${relationName}: { connect: { id: ${varName}.id }}`;
        })
        .join(', ');
      if (overrides) overrides = `, ${overrides}`;
    }

    let payloadConstruction = `const updatePayload = ${this.stringifyObject(updateData, true)};`;

    if (requiredFKs.length > 0 || actorRelationField) {
      const payloadOverridesList = requiredFKs.map((fk, i) => {
        const modelName = fk.model || 'Unknown';
        const varName = `${modelName.charAt(0).toLowerCase() + modelName.slice(1)}_${i}`;
        return `${fk.field}: ${varName}.id`;
      });

      if (actorRelationField) {
        const actorVal = `(${actorVar} ? (${actorVar} as unknown as { id: string }).id : undefined)`;
        payloadOverridesList.push(`${actorRelationField}: ${actorVal}`);
      }

      const payloadOverrides = payloadOverridesList.join(',\n                ');

      payloadConstruction = `const updatePayload = {
                ...${this.stringifyObject(updateData)},
                ${payloadOverrides}
            };`;
    }

    let setupSnippet = '';
    if (isActorModel) {
      setupSnippet = `const target = ${actorVar};`;
    } else {
      setupSnippet = `
            ${dependencySetup}
            const target = await Factory.create('${camelEntity}', { ...${JSON.stringify(mockData).replace(/"__DATE_NOW__"/g, 'new Date().toISOString()')}${this.getActorRelationSnippet(isActorUsed)}${overrides} });`;
    }

    const assertionBlock = Object.keys(updateData)
      .map((k) => {
        const field = this.model.fields[k];
        if (field && field.type === 'DateTime') {
          return `expect(updated?.${k}.toISOString()).toBe(updatePayload.${k}); // Compare as ISO strings`;
        }
        if (field && (field.isList || field.type === 'Json')) {
          return `expect(updated?.${k}).toStrictEqual(updatePayload.${k});`;
        }
        return `expect(updated?.${k}).toBe(updatePayload.${k});`;
      })
      .join('\n            ');

    const verificationBlock = assertionBlock
      ? `const updated = await Factory.prisma.${camelEntity}.findUnique({ where: { id: target.id } });
            ${assertionBlock}`
      : '// No specific assertions provided';

    return TemplateLoader.load('test/update.tsf', {
      kebabEntity,
      camelEntity,
      actorStatement,
      setupSnippet,
      updatePayload: payloadConstruction,
      assertionBlock: verificationBlock,
    }).raw;
  }

  private generateDeleteTests(
    kebabEntity: string,
    camelEntity: string,
    mockData: Record<string, unknown>,
  ): string {
    const isActorModel =
      (this.model.name || '').toLowerCase() === this.getTestActorModelName().toLowerCase();

    const requiredFKs = this.getRequiredForeignKeys();
    let dependencySetup = '';
    let overrides = '';

    const isActorUsed = isActorModel || !!this.getActorRelationSnippet(true);
    const actorVar = isActorUsed ? 'actor' : '_actor';
    const actorStatement = this.getActorStatement('delete', isActorUsed);

    if (!isActorModel && requiredFKs.length > 0) {
      const setups = requiredFKs.map((fk, i) => {
        const modelName = fk.model || 'Unknown';
        const varName = `${modelName.charAt(0).toLowerCase() + modelName.slice(1)}_${i}`;
        const targetModel = this.allModels.find((m) => m.name === fk.model);
        const isActorLinked = targetModel?.traits?.includes('actor-linked');
        const extras = isActorLinked
          ? `, actorId: (${actorVar} ? (${actorVar} as unknown as { id: string }).id : undefined), actorType: '${this.getTestActorModelName()}'`
          : '';
        return `const ${varName} = await Factory.create('${modelName.charAt(0).toLowerCase() + modelName.slice(1)}', {${extras.replace(/^, /, '')}});`;
      });
      dependencySetup = setups.join('\n            ');

      overrides = requiredFKs
        .map((fk, i) => {
          const modelName = fk.model || 'Unknown';
          const varName = `${modelName.charAt(0).toLowerCase() + modelName.slice(1)}_${i}`;
          const relationName = fk.field.endsWith('Id') ? fk.field.slice(0, -2) : fk.field;
          return `${relationName}: { connect: { id: ${varName}.id }}`;
        })
        .join(', ');
      if (overrides) overrides = `, ${overrides}`;
    }

    let setupSnippet = '';
    if (isActorModel) {
      setupSnippet = `const target = ${actorVar};`;
    } else {
      setupSnippet = `
            ${dependencySetup}
            const target = await Factory.create('${camelEntity}', { ...${JSON.stringify(mockData).replace(/"__DATE_NOW__"/g, 'new Date().toISOString()')}${this.getActorRelationSnippet(isActorUsed)}${overrides} });`;
    }

    return TemplateLoader.load('test/delete.tsf', {
      kebabEntity,
      camelEntity,
      actorStatement,
      setupSnippet,
    }).raw;
  }

  private generateMockData(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const [name, field] of Object.entries(this.model.fields)) {
      const isIdWithDefault =
        name === 'id' && field.attributes?.some((a) => a.startsWith('@default'));
      if (
        (name === 'id' && isIdWithDefault) ||
        name === 'createdAt' ||
        name === 'updatedAt' ||
        field.api === false ||
        field.private
      )
        continue;

      if (this.isForeignKey(name)) continue;

      if (!field.isRequired) continue;
      let val: unknown = null;
      if (field.type === 'String') val = `${name}_test`;
      else if (field.type === 'Boolean') val = true;
      else if (field.type === 'Int') val = 10;
      else if (field.type === 'Float' || field.type === 'Decimal') val = 10.5;
      else if (field.type === 'DateTime') val = '__DATE_NOW__';

      if (val !== null) {
        if (field.isList) {
          data[name] = [val];
        } else {
          data[name] = val;
        }
      }
    }
    return data;
  }

  private generateUpdateData(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const [name, field] of Object.entries(this.model.fields)) {
      const isIdWithDefault =
        name === 'id' && field.attributes?.some((a) => a.startsWith('@default'));
      if (
        (name === 'id' && isIdWithDefault) ||
        name === 'createdAt' ||
        name === 'updatedAt' ||
        field.api === false ||
        field.private
      )
        continue;

      if (this.isForeignKey(name)) continue;

      const reserved = [
        'id',
        'createdAt',
        'updatedAt',
        'actorId',
        'userId',
        'actorType',
        'lockedBy',
        'lockedAt',
        'status',
        'result',
        'error',
        'startedAt',
        'completedAt',
      ];
      if (reserved.includes(name)) continue;

      let val: unknown = null;
      if (field.type === 'String') val = `${name}_updated`;
      else if (field.type === 'Boolean') val = false;
      else if (field.type === 'Int') val = 20;
      else if (field.type === 'Float' || field.type === 'Decimal') val = 20.5;
      else if (field.type === 'DateTime') val = '__DATE_NOW__';

      if (val !== null) {
        if (field.isList) {
          data[name] = [val];
        } else {
          data[name] = val;
        }
      }
    }
    return data;
  }

  private stringifyObject(data: Record<string, unknown>, pretty = false): string {
    const json = JSON.stringify(data, null, pretty ? 8 : 0);
    return json
      .replace(/"([^"]+)":\s*/g, '$1: ')
      .replace(/"__DATE_NOW__"/g, 'new Date().toISOString()')
      .replace(/'/g, "\\'");
  }
}
