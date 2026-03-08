import prettier from 'prettier';
import path from 'node:path';
import { logger } from '@nexical/cli-core';

export class Formatter {
  private static configCache = new Map<string, prettier.Options | null>();

  static async format(content: string, filePath: string): Promise<string> {
    const configFile = await prettier.resolveConfigFile(filePath);
    let config: prettier.Options | null = null;

    if (configFile) {
      if (!this.configCache.has(configFile)) {
        this.configCache.set(configFile, await prettier.resolveConfig(configFile));
      }
      config = this.configCache.get(configFile) || null;
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
        ...config,
        filepath: filePath,
        parser: config?.parser || parser,
      };

      return await prettier.format(content, options);
    } catch (error) {
      logger.warn(`[Formatter] Failed to format ${filePath}: ${error}`);
      return content; // Fallback to unformatted content
    }
  }
}
