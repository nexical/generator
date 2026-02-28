import {
  type ModelDef,
  type FileDefinition,
  type VariableConfig,
  type FunctionConfig,
  type NodeContainer,
} from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';

export class FactoryBuilder extends BaseBuilder {
  constructor(private models: ModelDef[]) {
    super();
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    const factoriesBody: string[] = [];

    for (const model of this.models) {
      if (model.db === false) continue;

      const fields: string[] = [];

      // First pass: identify foreign keys and their relation info
      const fkMap = new Map<string, { relationName: string; relatedModel: string }>();
      for (const [fieldName, field] of Object.entries(model.fields)) {
        if (field.isRelation && field.attributes) {
          const relationAttr = field.attributes.find((a) => a.startsWith('@relation'));
          if (relationAttr) {
            const match = relationAttr.match(/fields:\s*\[([^\]]+)\]/);
            if (match) {
              const scalarFields = match[1].split(',').map((f) => f.trim());
              // We assume 1-to-1 mapping for simplicity or take first
              if (scalarFields.length > 0) {
                // relatedModel is the type of the relation field (e.g. User)
                // We need camelCase for factory reference
                const relatedModel = field.type.charAt(0).toLowerCase() + field.type.slice(1);
                fkMap.set(scalarFields[0], { relationName: fieldName, relatedModel });
              }
            }
          }
        }
      }

      for (const [fieldName, field] of Object.entries(model.fields)) {
        const isIdWithDefault =
          fieldName === 'id' && field.attributes?.some((a) => a.startsWith('@default'));
        if (
          (fieldName === 'id' && isIdWithDefault) ||
          fieldName === 'createdAt' ||
          fieldName === 'updatedAt'
        )
          continue;
        if (fieldName === 'password') continue;

        // Basic type detection (agnostic to Case)
        const type = field.type.toLowerCase();
        const isModelType = this.models.some((m) => m.name.toLowerCase() === type);

        // If it's a direct relation field, skip it (Prisma handles these, we want the scalar ID fields)
        if (isModelType) continue;

        // Check if it's an FK
        if (fkMap.has(fieldName) && field.isRequired) {
          const info = fkMap.get(fieldName)!;
          // Check if factory for related model exists/will exist (simple check: related model is in generic models list)
          // We generate nested create using the factory
          fields.push(`${info.relationName}: {
                        create: Factory.getBuilder('${info.relatedModel}')(index)
                    }`);
          continue;
        }

        let val: string | null = null;

        if (type === 'string') {
          if (fieldName.toLowerCase().includes('email')) {
            val = `\`\${index}_$\{crypto.randomUUID()}@example.com\`.toLowerCase()`;
          } else if (
            fieldName === 'username' ||
            fieldName === 'token' ||
            field.attributes?.some((a) => a.includes('@unique'))
          ) {
            val = `\`${fieldName}_\${index}_$\{crypto.randomUUID().split('-')[0]}\``;
          } else {
            val = `\`${fieldName}_\${index}\``;
          }
        } else if (type === 'int' || type === 'float') {
          val = 'index';
        } else if (type === 'boolean') {
          val = 'true';
        } else if (type === 'datetime') {
          val = 'new Date()';
        } else {
          // Enum fallback
          if (field.type === 'SiteRole') val = "'EMPLOYEE'";
          else if (field.type === 'UserStatus') val = "'ACTIVE'";
          else if (field.type === 'UserMode') val = "'SINGLE'";
          // If it's an enum we don't know, it'll stay null and be excluded
        }

        if (val) {
          if (field.isList) {
            val = `[${val}]`;
          }
          fields.push(`${fieldName}: ${val}`);
        }
      }

      if (model.fields['password']) {
        fields.push(`password: hashPassword('Password123!')`);
      }

      const modelCamelName = model.name.charAt(0).toLowerCase() + model.name.slice(1);
      factoriesBody.push(
        TemplateLoader.load('factory/entry.tsf', {
          modelCamelName,
          fields: fields.join(',\n                    '),
        }).raw,
      );
    }

    const factoryVariable: VariableConfig = {
      name: 'factories',
      declarationKind: 'const',
      isExported: true,
      initializer: TemplateLoader.load('factory/collection.tsf', {
        entries: factoriesBody.join(',\n            '),
      }),
    };

    const hashPasswordFunc: FunctionConfig = {
      name: 'hashPassword',
      isExported: true,
      overwriteBody: true,
      parameters: [{ name: 'password', type: 'string' }],
      returnType: 'string',
      statements: [TemplateLoader.load('factory/utils.tsf')],
    };

    const imports: any[] = [{ moduleSpecifier: 'bcryptjs', defaultImport: 'bcrypt' }];

    if (this.models.length > 0) {
      imports.push({
        moduleSpecifier: '@tests/integration/lib/factory',
        namedImports: ['Factory'],
      });
    }

    const allFactoriesBody = factoriesBody.join('\n');
    if (allFactoriesBody.includes('crypto.')) {
      imports.unshift({ moduleSpecifier: 'node:crypto', defaultImport: 'crypto' });
    }

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports,
      functions: [hashPasswordFunc],
      variables: [factoryVariable],
    };
  }
}
