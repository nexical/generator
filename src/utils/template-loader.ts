import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ts, type ParsedStatement } from '../engine/primitives/statements/factory.js';
import { tsx } from '../engine/primitives/jsx/factory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TemplateLoader {
  private static templatesDir = resolve(__dirname, '../../templates');
  private static activeModulePath: string | undefined;

  static setModulePath(modulePath: string | undefined) {
    this.activeModulePath = modulePath;
  }

  static load(path: string, variables: Record<string, string> = {}): ParsedStatement {
    let fullPath = join(this.templatesDir, path);
    // If an active module path is set, check if it has an override for this template
    if (this.activeModulePath) {
      const overridePath = join(this.activeModulePath, 'generator/templates', path);
      if (existsSync(overridePath)) {
        fullPath = overridePath;
      }
    }
    const fileContent = readFileSync(fullPath, 'utf-8');
    const ext = extname(path);

    // Regex to capture content inside: export default fragment`...`;
    // Supports optional /* ts */ or /* tsx */ comment
    // const regex = /export\s+default\s+fragment(?:\/\*\s*(ts|tsx)?\s*\*\/\s*)?`([\s\S]*)`;?\s*$/;
    // Updated regex to explicitly capture tag if present
    const regex =
      /export\s+default\s+fragment\s*(?:\/\*\s*(ts|tsx)\s*\*\/\s*)?`([\s\S]*)`\s*;?\s*$/;

    const match = fileContent.match(regex);
    if (!match) {
      throw new Error(`Invalid template format in ${path}. Must export default fragment\`...\``);
    }

    const explicitTag = match[1];
    let innerContent = match[2].trim();

    // Unescape backticks (since we captured raw text from file, and they are escaped in the source to be valid JS)
    innerContent = innerContent.replace(/\\`/g, '`').replace(/\\\${/g, '${');

    // Variable interpolation
    for (const [key, value] of Object.entries(variables)) {
      // Replace ${key} with value
      innerContent = innerContent.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
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
