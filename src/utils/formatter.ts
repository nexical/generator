import prettier from 'prettier';
import path from 'node:path';
import { logger } from '@nexical/cli-core';

export class Formatter {
  private static configCache: prettier.Options | null = null;
  private static hasCheckedConfig = false;

  static async format(content: string, filePath: string): Promise<string> {
    if (!this.hasCheckedConfig) {
      // Try to resolve config from the project root or generator root
      const configFile = await prettier.resolveConfigFile(filePath);
      if (configFile) {
        this.configCache = await prettier.resolveConfig(configFile);
      }
      this.hasCheckedConfig = true;
    }

    try {
      // Determine parser based on file extension
      const ext = path.extname(filePath);
      let parser = 'typescript'; // Default
      if (ext === '.json') parser = 'json';
      if (ext === '.css') parser = 'css';
      if (ext === '.md') parser = 'markdown';
      if (ext === '.yaml' || ext === '.yml') parser = 'yaml';

      // Allow prettier to infer if it can
      const options: prettier.Options = {
        ...this.configCache,
        filepath: filePath,
        parser: this.configCache?.parser || parser,
      };

      return await prettier.format(content, options);
    } catch (error) {
      logger.warn(`[Formatter] Failed to format ${filePath}: ${error}`);
      return content; // Fallback to unformatted content
    }
  }
}
