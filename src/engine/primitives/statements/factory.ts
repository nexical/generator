import { Project, Statement } from 'ts-morph';
import { type StatementConfig, type ParsedStatement } from '../../types.js';
import { VariableStatementPrimitive } from './variable.js';
import { ReturnStatementPrimitive } from './return.js';
import { ExpressionStatementPrimitive } from './expression.js';
import { JsxElementPrimitive } from '../jsx/element.js';
import { IfStatementPrimitive } from './if.js';
import { ThrowStatementPrimitive } from './throw.js';

export { type ParsedStatement };

export function ts(strings: TemplateStringsArray, ...values: unknown[]): ParsedStatement {
  const raw = strings.reduce((acc, str, i) => {
    return acc + str + (values[i] !== undefined ? values[i] : '');
  }, '');

  let tempFile: import('ts-morph').SourceFile | undefined;
  return {
    raw,
    getNodes(project: Project): Statement[] {
      const fileName = `__temp_fragment_${Date.now()}_${Math.random().toString(36).substring(7)}.ts`;
      tempFile = project.createSourceFile(fileName, raw, { overwrite: true });
      return tempFile.getStatements();
    },
    cleanup() {
      if (tempFile) {
        try {
          tempFile.delete();
        } catch {
          // Ignore if already deleted
        }
        tempFile = undefined;
      }
    },
  };
}

export class StatementFactory {
  static generate(config: StatementConfig): string {
    if (typeof config === 'string') {
      return config;
    }

    if ('getNodes' in config) {
      return config.raw;
    }

    switch (config.kind) {
      case 'variable':
        return new VariableStatementPrimitive(config).generate();
      case 'return':
        return new ReturnStatementPrimitive(config).generate();
      case 'expression':
        return new ExpressionStatementPrimitive(config).generate();
      case 'jsx':
        return new JsxElementPrimitive(config).generate();
      case 'if':
        return new IfStatementPrimitive(config).generate();
      case 'throw':
        return new ThrowStatementPrimitive(config).generate();
      default:
        throw new Error(`Unknown statement kind: ${(config as { kind: string }).kind}`);
    }
  }

  static generateBlock(configs?: StatementConfig[] | string | string[]): string {
    if (!configs) return '';
    if (typeof configs === 'string') return configs;
    if (Array.isArray(configs)) {
      return (configs as (string | StatementConfig)[])
        .map((c) => this.generate(c as StatementConfig))
        .join('\n');
    }
    return '';
  }

  // Helper for primitives that need indented blocks (like IF)
  static generateStringBlock(configs: StatementConfig[] | StatementConfig): string {
    const arr = Array.isArray(configs) ? configs : [configs];
    return arr.map((c) => this.generate(c)).join('\n');
  }
}
