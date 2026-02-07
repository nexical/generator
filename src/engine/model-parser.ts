import { type ModelDef, type EnumConfig, type GlobalConfig } from './types.js';
import { parse } from 'yaml';
import fs from 'node:fs';

export interface RawModelConfig {
  api?: boolean;
  db?: boolean;
  default?: boolean;
  extended?: boolean;
  actor?: {
    prefix?: string;
    name?: string;
    strategy?: 'login' | 'api-key' | 'bearer';
    fields?: Record<string, string>;
    validStatus?: string;
  };
  fields: Record<string, string | RawFieldConfig>;
  role?: string | Record<string, string>;
  test?: {
    actor?: string;
  };
  isExported?: boolean;
}

export interface RawFieldConfig {
  type: string;
  isRequired?: boolean;
  isList?: boolean;
  attributes?: string[];
  api?: boolean;
  private?: boolean;
}

export class ModelParser {
  static parse(modelsYamlPath: string): {
    models: ModelDef[];
    enums: EnumConfig[];
    config: GlobalConfig;
  } {
    if (!fs.existsSync(modelsYamlPath)) {
      return { models: [], enums: [], config: {} };
    }

    const content = fs.readFileSync(modelsYamlPath, 'utf-8');
    const parsed = parse(content);
    const rawModels: Record<string, RawModelConfig> = parsed.models || {};
    const rawEnums = parsed.enums || {};

    const enums: EnumConfig[] = Object.entries(rawEnums).map(
      ([name, values]: [string, unknown]) => {
        let memberNames: string[] = [];

        if (Array.isArray(values)) {
          memberNames = values;
        } else if (typeof values === 'object' && values !== null) {
          // Check if it has a 'values' property which is an array
          const v = values as { values?: unknown[] };
          if (Array.isArray(v.values)) {
            memberNames = v.values.map(String);
          } else {
            // Fallback to keys if it's a record without 'values' array
            memberNames = Object.keys(values);
          }
        }

        return {
          name,
          isExported: true,
          members: memberNames.map((m) => ({ name: m, value: m })),
        };
      },
    );

    const enumNames = new Set(Object.keys(rawEnums));
    const modelNames = new Set(Object.keys(rawModels));

    const models: ModelDef[] = Object.entries(rawModels).map(([name, config]) => {
      console.info(`[ModelParser] Model: ${name}, keys: ${Object.keys(config).join(', ')}`);
      const model: ModelDef = {
        name,
        api: config.api !== false,
        db: config.db !== false,
        default: config.default === true,
        extended: config.extended === true,
        actor: config.actor as ModelDef['actor'], // Cast to ModelDef['actor'] to avoid strict "strategy required" check against optional YAML
        fields: {},
        role: config.role,
        test: config.test,
        isExported: config.isExported !== false,
      };

      // Normalize fields
      for (const fieldName in config.fields) {
        const rawField = config.fields[fieldName];
        const field: RawFieldConfig = typeof rawField === 'string' ? { type: rawField } : rawField;

        const isEnum = enumNames.has(field.type);
        const isRelation = modelNames.has(field.type);

        model.fields[fieldName] = {
          type: field.type,
          isRequired: field.isRequired !== false,
          isList: field.isList === true,
          attributes: field.attributes || [],
          api: field.api !== false,
          private: field.private === true,
          isEnum,
          enumValues: isEnum
            ? (() => {
                const val = rawEnums[field.type] as unknown;
                if (Array.isArray(val)) return val.map(String);
                if (typeof val === 'object' && val !== null) {
                  const v = val as { values?: unknown[] };
                  if (Array.isArray(v.values)) return v.values.map(String);
                  return Object.keys(val);
                }
                return [];
              })()
            : undefined,
          isRelation,
          relationTo: isRelation ? field.type : undefined,
        };
      }

      return model;
    });

    const config = parsed.config || {};
    return { models, enums, config };
  }
}
