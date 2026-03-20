import { loadConfig } from '@nexical/cli-core';
import path from 'node:path';
import fs from 'node:fs';

export interface NexicalConfig {
  modules?: {
    paths?: Record<string, string[]>;
  };
  generator?: {
    defaults?: {
      superRole?: string;
      defaultRole?: string;
    };
  };
}

export class PathResolver {
  private static config: NexicalConfig | null = null;
  private static rootPath: string = process.cwd();

  static async init() {
    if (this.config) return;

    // Find the directory containing nexical.yaml by walking up from CWD
    let currentDir = process.cwd();
    while (currentDir !== path.parse(currentDir).root) {
      if (fs.existsSync(path.join(currentDir, 'nexical.yaml'))) {
        this.rootPath = currentDir;
        break;
      }
      currentDir = path.dirname(currentDir);
    }

    this.config = (await loadConfig('nexical', this.rootPath)) as NexicalConfig;
  }

  /**
   * Resolves the absolute path to a module based on its name and the configuration in nexical.yaml.
   */
  static resolve(moduleName: string): string {
    if (!this.config) {
      throw new Error('PathResolver not initialized. Call PathResolver.init() first.');
    }

    const modulePaths = this.config.modules?.paths || {};
    for (const [dir, patterns] of Object.entries(modulePaths)) {
      if (Array.isArray(patterns)) {
        for (const pattern of patterns) {
          const regex = new RegExp(`^${pattern}$`);
          if (regex.test(moduleName)) {
            return path.join(this.rootPath, dir, moduleName);
          }
        }
      }
    }

    throw new Error(
      `Could not resolve path for module: ${moduleName}. Please check your modules.paths configuration in nexical.yaml.`,
    );
  }

  /**
   * Returns ecosystem-wide defaults for roles and other generator settings.
   */
  static getDefaults() {
    return {
      superRole: this.config?.generator?.defaults?.superRole || 'USER_ADMIN',
      defaultRole: this.config?.generator?.defaults?.defaultRole || 'USER_EMPLOYEE',
    };
  }
}
