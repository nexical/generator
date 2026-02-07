import {
  type ModelDef,
  type FileDefinition,
  type TestRoleConfig,
  type NodeContainer,
} from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';
import { ts } from '../primitives/statements/factory.js';

type TestOperation = 'create' | 'list' | 'get' | 'update' | 'delete';

export class TestBuilder extends BaseBuilder {
  constructor(
    private model: ModelDef,
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
    const testConfig = this.model.test;
    const actor = testConfig?.actor;
    if (!actor) {
      console.warn(
        `[TestBuilder] Warning: Model [${this.model.name}] is missing 'test.actor' config. Falling back to 'user'.`,
      );
      return 'user';
    }
    return actor;
  }

  private getActorRelationSnippet(): string {
    const actorName = this.getTestActorModelName();
    // Skip self-referential links (e.g. Team acting on Team)
    if (this.model.name.toLowerCase() === actorName.toLowerCase()) {
      return '';
    }

    for (const [name, field] of Object.entries(this.model.fields)) {
      // Check if field type matches actor name (case insensitive)
      if (field.type && field.type.toLowerCase() === actorName.toLowerCase()) {
        return `, ${name}: { connect: { id: actor.id } }`;
      }
    }

    // Loose coupling: check for actorId or userId
    if (this.model.fields['actorId']) return `, actorId: actor.id, actorType: '${actorName}'`;
    if (this.model.fields['userId'] && actorName.toLowerCase() === 'user')
      return `, userId: actor.id`;

    return '';
  }

  private getActorStatement(operation: string, isUsed: boolean = false): string {
    const requiredRole = this.getRole(operation);
    const actorName = this.model.test?.actor || 'user';

    if (requiredRole === 'public') {
      return `// Public access - no auth required\n    ${!isUsed ? '// eslint-disable-next-line @typescript-eslint/no-unused-vars\n    ' : ''}const actor = undefined as unknown;`;
    }

    // Check config first
    if (this.roleConfig[requiredRole]) {
      const optsArray = JSON.stringify(this.roleConfig[requiredRole])
        .replace(/"([^"]+)":/g, '$1:')
        .replace(/"/g, "'");
      return `${!isUsed ? '// eslint-disable-next-line @typescript-eslint/no-unused-vars\n      ' : ''}const actor = await client.as('${actorName}', ${optsArray});`;
    }

    // Fallback
    return `${!isUsed ? '// eslint-disable-next-line @typescript-eslint/no-unused-vars\n    ' : ''}const actor = await client.as('${actorName}', {});`;
  }

  private getNegativeActorStatement(operation: TestOperation): string {
    return `client.useToken('invalid-token');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const actor = undefined as unknown;`;
  }

  private getUniqueField(): string | null {
    // Priority: email > username > any unique string field
    if (this.model.fields['email']) return 'email';
    if (this.model.fields['username']) return 'username';

    for (const [name, field] of Object.entries(this.model.fields)) {
      if (field.type === 'String' && field.attributes?.some((a) => a.includes('@unique'))) {
        return name;
      }
    }
    return null;
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
    const entityName = this.model.name;
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

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports: imports,
      variables: [],
      statements: [
        ts`describe('${entityName} API - ${this.operation.charAt(0).toUpperCase() + this.operation.slice(1)}', () => {
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
    // ... logic for payloadConstruction remains ...
    // Constructing payload string manually here to match existing logic exactly or reusing valid parts
    let payloadConstruction = `const payload = ${JSON.stringify(mockData, null, 8)
      .replace(/"([^"]+)":/g, '$1:')
      .replace(/"__DATE_NOW__"/g, 'new Date().toISOString()')};`;

    if (requiredFKs.length > 0 || actorRelationField) {
      const setups = requiredFKs.map((fk, i) => {
        const varName = `${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}_${i}`;
        const extras =
          fk.model === 'Job'
            ? `, actorId: (typeof actor !== "undefined" ? (actor as any).id : undefined), actorType: '${this.getTestActorModelName()}'`
            : '';
        return `const ${varName} = await Factory.create('${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}', { ${extras.replace(/^, /, '')} });`;
      });
      dependencySetup = setups.join('\n            ');

      const overrides = requiredFKs.map((fk, i) => {
        const varName = `${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}_${i}`;
        return `${fk.field}: ${varName}.id`;
      });

      if (actorRelationField) {
        overrides.push(`${actorRelationField}: (actor ? (actor as any).id : undefined)`);
      }

      const overridesString = overrides.join(',\n                ');

      payloadConstruction = `const payload = {
  ...${JSON.stringify(mockData).replace(/"__DATE_NOW__"/g, 'new Date().toISOString()')},
                ${overridesString}
            }; `;
    }

    const isActorUsed = requiredFKs.some((fk) => fk.model === 'Job') || !!actorRelationField;
    const actorStatement = this.getActorStatement('create', isActorUsed);

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

    const negativeActorStatement = this.getNegativeActorStatement('create');

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
    const isActorModel = this.model.name.toLowerCase() === actorModelName.toLowerCase();
    const actorFK = this.findActorForeignKey();

    const baseDataConfig = JSON.stringify(mockData).replace(
      /"__DATE_NOW__"/g,
      'new Date().toISOString()',
    );

    const filterTests = Object.keys(this.model.fields)
      .filter(
        // Reuse existing filter logic
        (f) =>
          !['id', 'createdAt', 'updatedAt', 'actorId', 'userId', 'actorType'].includes(f) &&
          this.model.fields[f].type === 'String' &&
          this.model.fields[f].api !== false &&
          !this.model.fields[f].private &&
          !this.model.fields[f].isList &&
          !this.isForeignKey(f),
      )
      .map((field) => {
        const uniqueField = this.getUniqueField();
        let uniqueInjectionA = '';
        let uniqueInjectionB = '';

        if (uniqueField && uniqueField !== field) {
          const _listSuffix = uniqueField === 'email' ? '@example.com' : '';
          uniqueInjectionA = `, ${uniqueField}: 'filter_a_' + Date.now() + '${_listSuffix}'`;
          uniqueInjectionB = `, ${uniqueField}: 'filter_b_' + Date.now() + '${_listSuffix}'`;
        }

        // Note: Template literal inside loop string generation
        return `
  it('should filter by ${field}', async () => {
    // Wait to avoid collisions
    await new Promise(r => setTimeout(r, 10));
    // Reuse getActorStatement to ensure correct actor context
    ${this.getActorStatement('list', !!this.getActorRelationSnippet())}
    ${this.model.test?.actor === 'user' && this.model.role && typeof this.model.role === 'object' && this.model.role.list !== 'admin' ? `// Note: Ensure role allows filtering if restricted` : ''}

    const val1 = '${field}_' + Date.now() + '_A${field === 'email' ? '@example.com' : ''}';
    const val2 = '${field}_' + Date.now() + '_B${field === 'email' ? '@example.com' : ''}';

    const data1 = { ...baseData, ${field}: val1${uniqueInjectionA} };
    const data2 = { ...baseData, ${field}: val2${uniqueInjectionB} };

    await Factory.create('${camelEntity}', { ...data1${this.getActorRelationSnippet()} });
    await Factory.create('${camelEntity}', { ...data2${this.getActorRelationSnippet()} });

    const res = await client.get('/api/${kebabEntity}?${field}=' + val1);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].${field}).toBe(val1);
  });`;
      })
      .join('\n');

    const isAuthResource = ['token', 'key', 'session'].some((k) =>
      camelEntity.toLowerCase().includes(k),
    );
    const shouldPreserve = isActorModel || (isAuthResource && !!this.findActorForeignKey());

    let cleanupClause = '';
    if (shouldPreserve) {
      if (isActorModel) {
        cleanupClause = `await Factory.prisma.${camelEntity}.deleteMany({ where: { id: { not: actor.id } } }); `;
      } else {
        cleanupClause = `await Factory.prisma.${camelEntity}.deleteMany({ where: { ${actorFK}: { not: actor.id } } }); `;
      }
    } else {
      cleanupClause = `await Factory.prisma.${camelEntity}.deleteMany(); `;
    }

    const isActorUsed =
      shouldPreserve || !!this.getActorRelationSnippet() || !!this.getActorRelationFieldName();
    const actorStatement = this.getActorStatement('list', isActorUsed);
    const actorStatementNeg = this.getActorStatement('list', false);

    const seedClause = (() => {
      const unique = this.getUniqueField();
      const rel = this.getActorRelationSnippet();
      if (unique) {
        const s = unique === 'email' ? '@example.com' : '';
        return `await Factory.create('${camelEntity}', { ...baseData, ${unique}: 'list_1_' + _listSuffix + '${s}'${rel} });
             await Factory.create('${camelEntity}', { ...baseData, ${unique}: 'list_2_' + _listSuffix + '${s}'${rel} });`;
      }
      return `await Factory.create('${camelEntity}', { ...baseData${rel} });
             await Factory.create('${camelEntity}', { ...baseData${rel} });`;
    })();

    // Pagination Seed Logic
    const field = isActorModel ? 'id' : this.findActorForeignKey() || 'userId';
    const currentCountLogic = cleanupClause.includes('where')
      ? `currentCount = await Factory.prisma.${camelEntity}.count({ where: { ${field}: actor.id } });`
      : '';

    const loopBody = (() => {
      const unique = this.getUniqueField();
      const rel = this.getActorRelationSnippet();
      if (unique) {
        const s = unique === 'email' ? '@example.com' : '';
        return `const rec = await Factory.create('${camelEntity}', { ...baseData, ${unique}: \`page_\${i}_\${_listSuffix}${s}\`${rel} });
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

    const isActorUsedInPagination = shouldPreserve;
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
      this.model.name.toLowerCase() === this.getTestActorModelName().toLowerCase();

    const requiredFKs = this.getRequiredForeignKeys();
    let dependencySetup = '';
    let overrides = '';

    if (!isActorModel && requiredFKs.length > 0) {
      const setups = requiredFKs.map((fk, i) => {
        const varName = `${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}_${i} `;
        const extras =
          fk.model === 'Job'
            ? `, actorId: (typeof actor !== "undefined" ? actor.id : undefined), actorType: '${this.getTestActorModelName()}'`
            : '';
        return `const ${varName} = await Factory.create('${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}', { ${extras.replace(/^, /, '')}}); `;
      });
      dependencySetup = setups.join('\n            ');

      overrides = requiredFKs
        .map((fk, i) => {
          const varName = `${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}_${i} `;
          const relationName = fk.field.endsWith('Id') ? fk.field.slice(0, -2) : fk.field;
          return `${relationName}: { connect: { id: ${varName}.id } } `;
        })
        .join(', ');
      if (overrides) overrides = `, ${overrides} `;
    }

    let setupSnippet = '';
    if (isActorModel) {
      setupSnippet = `const target = actor; `;
    } else {
      setupSnippet = `
            ${dependencySetup}
const target = await Factory.create('${camelEntity}', { ...${JSON.stringify(mockData).replace(/"__DATE_NOW__"/g, 'new Date().toISOString()')}${this.getActorRelationSnippet()}${overrides} }); `;
    }

    const isActorUsed = isActorModel || !!this.getActorRelationSnippet();
    const actorStatement = this.getActorStatement('get', isActorUsed);
    const actorStatementNeg = this.getActorStatement('get', false);

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
    const updatePayload = JSON.stringify(updateData, null, 8)
      .replace(/"([^"]+)":/g, '$1:')
      .replace(/"__DATE_NOW__"/g, 'new Date().toISOString()');
    const isActorModel =
      this.model.name.toLowerCase() === this.getTestActorModelName().toLowerCase();

    const requiredFKs = this.getRequiredForeignKeys();
    let dependencySetup = '';
    let overrides = '';

    if (!isActorModel && requiredFKs.length > 0) {
      const setups = requiredFKs.map((fk, i) => {
        const varName = `${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}_${i}`;
        const extras =
          fk.model === 'Job'
            ? `, actorId: (typeof actor !== "undefined" ? actor.id : undefined), actorType: '${this.getTestActorModelName()}'`
            : '';
        return `const ${varName} = await Factory.create('${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}', {${extras.replace(/^, /, '')}});`;
      });
      dependencySetup = setups.join('\n            ');

      overrides = requiredFKs
        .map((fk, i) => {
          const varName = `${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}_${i}`;
          const relationName = fk.field.endsWith('Id') ? fk.field.slice(0, -2) : fk.field;
          return `${relationName}: { connect: { id: ${varName}.id } }`;
        })
        .join(', ');
      if (overrides) overrides = `, ${overrides}`;
    }

    let setupSnippet = '';
    if (isActorModel) {
      setupSnippet = `const target = actor;`;
    } else {
      setupSnippet = `
            ${dependencySetup}
            const target = await Factory.create('${camelEntity}', { ...${JSON.stringify(mockData).replace(/"__DATE_NOW__"/g, 'new Date().toISOString()')}${this.getActorRelationSnippet()}${overrides} });`;
    }

    const isActorUsed =
      isActorModel ||
      requiredFKs.some((fk) => fk.model === 'Job') ||
      !!this.getActorRelationSnippet();

    const actorStatement = this.getActorStatement('update', isActorUsed);

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

    return TemplateLoader.load('test/update.tsf', {
      kebabEntity,
      camelEntity,
      actorStatement,
      setupSnippet,
      updatePayload,
      assertionBlock,
    }).raw;
  }

  private generateDeleteTests(
    kebabEntity: string,
    camelEntity: string,
    mockData: Record<string, unknown>,
  ): string {
    const isActorModel =
      this.model.name.toLowerCase() === this.getTestActorModelName().toLowerCase();

    const requiredFKs = this.getRequiredForeignKeys();
    let dependencySetup = '';
    let overrides = '';

    if (!isActorModel && requiredFKs.length > 0) {
      const setups = requiredFKs.map((fk, i) => {
        const varName = `${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}_${i}`;
        const extras =
          fk.model === 'Job'
            ? `, actorId: (typeof actor !== "undefined" ? actor.id : undefined), actorType: '${this.getTestActorModelName()}'`
            : '';
        return `const ${varName} = await Factory.create('${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}', {${extras.replace(/^, /, '')}});`;
      });
      dependencySetup = setups.join('\n            ');

      overrides = requiredFKs
        .map((fk, i) => {
          const varName = `${fk.model.charAt(0).toLowerCase() + fk.model.slice(1)}_${i}`;
          const relationName = fk.field.endsWith('Id') ? fk.field.slice(0, -2) : fk.field;
          return `${relationName}: { connect: { id: ${varName}.id } }`;
        })
        .join(', ');
      if (overrides) overrides = `, ${overrides}`;
    }

    let setupSnippet = '';
    if (isActorModel) {
      setupSnippet = `const target = actor;`;
    } else {
      setupSnippet = `
            ${dependencySetup}
            const target = await Factory.create('${camelEntity}', { ...${JSON.stringify(mockData).replace(/"__DATE_NOW__"/g, 'new Date().toISOString()')}${this.getActorRelationSnippet()}${overrides} });`;
    }

    const isActorUsed = isActorModel || !!this.getActorRelationSnippet();
    const actorStatement = this.getActorStatement('delete', isActorUsed);

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
}
