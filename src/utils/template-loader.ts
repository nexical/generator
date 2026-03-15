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

  static load(path: string, variables: Record<string, unknown> = {}): ParsedStatement {
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

    // Variable interpolation using JS evaluation to support expressions (ternaries, etc.)
    const keys = Object.keys(variables);
    const values = Object.values(variables);

    try {
      let result = '';
      let i = 0;
      while (i < innerContent.length) {
        let isEscaped = false;
        // Handle escaped characters: \${ and \`
        if (innerContent[i] === '\\' && i + 1 < innerContent.length) {
          const next = innerContent[i + 1];
          if (next === '$') {
            isEscaped = true;
            i++; // Move to '$' and proceed to interpolation check
          } else if (next === '`') {
            result += '`';
            i += 2;
            continue;
          }
        }

        // Handle interpolation: ${ ... }
        if (innerContent[i] === '$' && innerContent[i + 1] === '{') {
          const start = i + 2;
          let depth = 1;
          let end = start;

          // Find matching closing brace, handling nested ones
          while (end < innerContent.length && depth > 0) {
            if (innerContent[end] === '{') depth++;
            else if (innerContent[end] === '}') depth--;
            end++;
          }

          if (depth === 0) {
            const expression = innerContent.substring(start, end - 1);
            try {
              // Unescape backticks and interpolations for evaluation
              const evalExpression = expression.replace(/\\`/g, '`').replace(/\\\$/g, '$');
              // Heuristic: If this was escaped, only evaluate if it references at least one variable
              // from the variables map. This prevents premature evaluation of things like ${this.name}
              // or ${crypto.randomUUID()} which are valid JS in the generator context.
              let shouldEvaluate = !isEscaped;
              if (isEscaped && keys.length > 0) {
                const varPattern = new RegExp(
                  `\\b(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
                );
                if (varPattern.test(evalExpression)) {
                  shouldEvaluate = true;
                }
              }

              if (shouldEvaluate) {
                // Use strict mode to prevent accidental 'this' access
                const fn = new Function(...keys, `"use strict"; return (${evalExpression});`);
                result += String(fn(...values));
              } else {
                // Keep as literal if it's escaped and doesn't reference our variables
                result += `\${${expression}}`;
              }
            } catch (evalError) {
              if (!isEscaped) {
                console.warn(
                  `[TemplateLoader] Failed to evaluate expression "${expression}" in ${path}:`,
                  evalError,
                );
              }
              // Fallback to literal if evaluation fails
              result += `\${${expression}}`;
            }
            i = end;
            continue;
          }
        }

        // Regular character
        result += innerContent[i];
        i++;
      }
      innerContent = result;
    } catch (error) {
      console.warn(
        `[TemplateLoader] Failed to process template ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback to simple replacement for basic cases if holistic processing fails
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
