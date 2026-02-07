import { glob } from 'glob';
import path from 'path';
import fs from 'fs-extra';

export class ModuleLocator {
  /**
   * Expands a module name pattern into a list of existing module names.
   * The pattern can be a direct name (e.g., 'chat-api') or a glob pattern (e.g., '*-api').
   * If the pattern matches directories in the modules/ folder, those directory names are returned.
   *
   * @param pattern The module name or glob pattern
   * @returns A promise resolving to a list of module names
   */
  static async expand(pattern: string): Promise<string[]> {
    const modulesRoot = path.join(process.cwd(), 'modules');

    // If the pattern is a direct match for a directory, return it (backward compatibility for exact names without glob chars)
    const directPath = path.join(modulesRoot, pattern);
    if (
      (await fs.pathExists(directPath)) &&
      (await fs.stat(directPath)).isDirectory() &&
      !glob.hasMagic(pattern)
    ) {
      return [pattern];
    }

    // Otherwise, treat as a glob pattern within the modules directory
    const matches = await glob(pattern, {
      cwd: modulesRoot,
    });

    // Filter for directories only
    const directories: string[] = [];
    for (const match of matches) {
      const fullPath = path.join(modulesRoot, match);
      if ((await fs.stat(fullPath)).isDirectory()) {
        directories.push(match.replace(/\/$/, ''));
      }
    }

    return directories;
  }
}
