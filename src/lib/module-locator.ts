import { glob } from 'glob';
import path from 'path';
import fs from 'node:fs';
import fse from 'fs-extra';

export interface ModuleInfo {
  name: string;
  path: string; // Absolute path
  app: 'backend' | 'frontend' | 'legacy';
}

export class ModuleLocator {
  private static rootPath: string = '';

  private static getRoot(): string {
    if (this.rootPath) return this.rootPath;

    let currentDir = process.cwd();
    while (currentDir !== path.parse(currentDir).root) {
      if (fs.existsSync(path.join(currentDir, 'nexical.yaml'))) {
        this.rootPath = currentDir;
        return this.rootPath;
      }
      currentDir = path.dirname(currentDir);
    }

    this.rootPath = process.cwd();
    return this.rootPath;
  }

  /**
   * Expands a module name pattern into a list of existing module names.
   * The pattern can be a direct name (e.g., 'chat-api'), a glob pattern (e.g., '*-api'),
   * or a prefixed name (e.g., 'backend:chat-api').
   *
   * @param pattern The module name or glob pattern
   * @returns A promise resolving to a list of module info objects
   */
  static async expand(pattern: string): Promise<ModuleInfo[]> {
    const results: ModuleInfo[] = [];
    const rootPath = this.getRoot();

    // Parse prefix
    let prefix: string | undefined;
    let searchPattern = pattern;

    if (pattern.includes(':')) {
      const parts = pattern.split(':');
      prefix = parts[0];
      searchPattern = parts[1];
    }

    // Define search roots
    const roots = [
      { type: 'backend', path: path.join(rootPath, 'apps/backend/modules') },
      { type: 'frontend', path: path.join(rootPath, 'apps/frontend/modules') },
    ] as const;

    // Filter roots based on prefix
    const activeRoots = roots.filter((r) => {
      if (!prefix) return true;
      if (prefix === 'backend') return r.type === 'backend';
      if (prefix === 'frontend') return r.type === 'frontend';
      return false; // Unknown prefix
    });

    for (const root of activeRoots) {
      if (!(await fse.pathExists(root.path))) continue;

      // Check for direct match first (if no glob magic)
      if (!glob.hasMagic(searchPattern)) {
        const directPath = path.join(root.path, searchPattern);
        if ((await fse.pathExists(directPath)) && (await fse.stat(directPath)).isDirectory()) {
          results.push({
            name: searchPattern,
            path: directPath,
            app: root.type,
          });
        }
        continue;
      }

      // Glob search
      const matches = await glob(searchPattern, { cwd: root.path });
      for (const match of matches) {
        const fullPath = path.join(root.path, match);
        if ((await fse.stat(fullPath)).isDirectory()) {
          results.push({
            name: match.replace(/\/$/, ''),
            path: fullPath,
            app: root.type,
          });
        }
      }
    }

    return results;
  }

  /**
   * Resolves a target path for a new module.
   * Handles 'backend:name', 'frontend:name' or defaults to backend if ambiguous/unspecified.
   */
  static resolve(pattern: string): ModuleInfo {
    let prefix = 'backend'; // Default to backend for new modules if unspecified? Or maybe try to infer?
    // Actually, distinct defaults: if *-api -> backend, if *-ui -> frontend?
    // safely default to backend for now, or error if ambiguous.

    let name = pattern;

    if (pattern.includes(':')) {
      const parts = pattern.split(':');
      prefix = parts[0];
      name = parts[1];
    } else {
      // Heuristics:
      if (name.endsWith('-ui')) {
        prefix = 'frontend';
      } else if (name.endsWith('-api') || name.endsWith('-email')) {
        prefix = 'backend';
      }
    }

    const rootRelPath = prefix === 'frontend' ? 'apps/frontend/modules' : 'apps/backend/modules';

    return {
      name,
      path: path.join(this.getRoot(), rootRelPath, name),
      app: prefix as ModuleInfo['app'],
    };
  }
}
