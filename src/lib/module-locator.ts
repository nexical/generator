import { glob } from 'glob';
import path from 'path';
import fs from 'fs-extra';

export interface ModuleInfo {
  name: string;
  path: string; // Absolute path
  app: 'backend' | 'frontend' | 'legacy';
}

export class ModuleLocator {
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
      { type: 'backend', path: path.join(process.cwd(), 'apps/backend/modules') },
      { type: 'frontend', path: path.join(process.cwd(), 'apps/frontend/modules') },
    ];

    // Filter roots based on prefix
    const activeRoots = roots.filter((r) => {
      if (!prefix) return true;
      if (prefix === 'backend') return r.type === 'backend';
      if (prefix === 'frontend') return r.type === 'frontend';
      return false; // Unknown prefix
    });

    for (const root of activeRoots) {
      if (!(await fs.pathExists(root.path))) continue;

      // Check for direct match first (if no glob magic)
      if (!glob.hasMagic(searchPattern)) {
        const directPath = path.join(root.path, searchPattern);
        if ((await fs.pathExists(directPath)) && (await fs.stat(directPath)).isDirectory()) {
          results.push({
            name: searchPattern,
            path: directPath,
            app: root.type as any,
          });
        }
        continue;
      }

      // Glob search
      const matches = await glob(searchPattern, { cwd: root.path });
      for (const match of matches) {
        const fullPath = path.join(root.path, match);
        if ((await fs.stat(fullPath)).isDirectory()) {
          results.push({
            name: match.replace(/\/$/, ''),
            path: fullPath,
            app: root.type as any,
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

    const rootPath =
      prefix === 'frontend' ? 'apps/frontend/modules' : 'apps/backend/modules';

    return {
      name,
      path: path.join(process.cwd(), rootPath, name),
      app: prefix as any,
    };
  }
}
