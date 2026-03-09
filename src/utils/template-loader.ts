import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ts, type ParsedStatement } from '../engine/primitives/statements/factory.js';
import { tsx } from '../engine/primitives/jsx/factory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type TemplateFileSystem = {
  readFileSync(path: string, encoding: 'utf-8'): string;
  existsSync(path: string): boolean;
};

export class TemplateLoader {
  private static templatesDir = resolve(__dirname, '../../templates');
  private static activeModulePath: string | undefined;
  private static fs: TemplateFileSystem = { readFileSync, existsSync };

  static setFileSystem(fs: TemplateFileSystem) {
    this.fs = fs;
  }

  static restoreDefaultFileSystem() {
    this.fs = { readFileSync, existsSync };
  }

  static setModulePath(modulePath: string | undefined) {
    this.activeModulePath = modulePath;
  }

  static load(path: string, variables: Record<string, string> = {}): ParsedStatement {
    let fullPath = join(this.templatesDir, path);
    // If an active module path is set, check if it has an override for this template
    if (this.activeModulePath) {
      const overridePath = join(this.activeModulePath, 'generator/templates', path);
      if (this.fs.existsSync(overridePath)) {
        fullPath = overridePath;
      }
    }
    const fileContent = this.fs.readFileSync(fullPath, 'utf-8').trim();
    const ext = extname(path);

    const startMatch = fileContent.match(/export\s+default\s+fragment/);
    if (!startMatch || startMatch.index === undefined) {
      throw new Error(`Invalid template format in ${path}. Must export default fragment\`...\``);
    }
    const startIndex = startMatch.index;
    const exportTag = startMatch[0];

    const afterExport = fileContent.substring(startIndex + exportTag.length);
    const firstBacktick = afterExport.indexOf('`');
    if (firstBacktick === -1) {
      throw new Error(`Invalid template format in ${path}. Missing opening backtick.`);
    }

    const lastBacktick = afterExport.lastIndexOf('`');
    if (lastBacktick === -1 || lastBacktick === firstBacktick) {
      throw new Error(`Invalid template format in ${path}. Missing closing backtick.`);
    }

    const tagContent = afterExport.substring(0, firstBacktick);
    const explicitTag = tagContent.includes('tsx')
      ? 'tsx'
      : tagContent.includes('ts')
        ? 'ts'
        : undefined;
    let innerContent = afterExport.substring(firstBacktick + 1, lastBacktick);

    // Unescape backticks (since we captured raw text from file, and they are escaped in the source to be valid JS)
    innerContent = innerContent.replace(/\\`/g, '`').replace(/\\\${/g, '${');

    // Variable interpolation using JS evaluation to support expressions (ternaries, etc.)
    const keys = Object.keys(variables);
    const values = Object.values(variables);
    try {
      // Use Function constructor to evaluate template literal string with provided variables as arguments
      // We wrap innerContent in another backtick layer, so we need to escape backticks and ${ inside it
      const escapedContent = innerContent.replace(/`/g, '\\`').replace(/\${/g, '\\${');

      // But wait! We WANT the variables in 'keys' to be interpolated.
      // So we need to selective UNESCAPE ${key} for each key in keys.
      let finalContent = escapedContent;
      for (const key of keys) {
        finalContent = finalContent.replace(new RegExp(`\\\\\\$\\{${key}\\}`, 'g'), `\${${key}}`);
      }

      const fn = new Function(...keys, `return \`${finalContent}\`;`);
      innerContent = fn(...values);
    } catch (error) {
      console.warn(
        `[TemplateLoader] Failed to evaluate template as JS expression, falling back to simple replacement: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback to simple replacement for basic cases if evaluation fails
      for (const [key, value] of Object.entries(variables)) {
        innerContent = innerContent.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
      }
    }

    const substrings = [innerContent];
    (substrings as unknown as { raw: string[] }).raw = [innerContent];
    const templateStrings = substrings as unknown as TemplateStringsArray;

    // Logic:
    // 1. If explicit /* tsx */ tag, use tsx
    // 2. If file extension is .txf, use tsx
    // 3. Default to ts
    if (explicitTag === 'tsx' || ext === '.txf') {
      return tsx(templateStrings);
    }

    return ts(templateStrings);
  }
}
