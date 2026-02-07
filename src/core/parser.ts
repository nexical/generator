import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { PlatformDefinitionSchema, type PlatformDefinition } from '../schema.js';

import { logger } from '@nexical/cli-core';

export class PlatformParser {
  static parseFile(filePath: string): PlatformDefinition {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const raw = yaml.parse(content);

    // Validate against our schema
    const result = PlatformDefinitionSchema.safeParse(raw);

    if (!result.success) {
      logger.error(`Validation failed for ${filePath}:`);
      logger.error(JSON.stringify(result.error.issues, null, 2));
      throw new Error('Schema validation failed');
    }

    return result.data;
  }

  static parseModule(modulePath: string): PlatformDefinition {
    const modelPath = path.join(modulePath, 'models.yaml');
    return this.parseFile(modelPath);
  }
}
