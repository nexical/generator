import {
  type FileDefinition,
  type ClassDefinition,
  type MethodConfig,
  type ImportConfig,
  type NodeContainer,
  type ParsedStatement,
} from '../types.js';
import { BaseBuilder } from './base-builder.js';
import { TemplateLoader } from '../../utils/template-loader.js';
import { ts } from '../primitives/statements/factory.js';

export class ActionBuilder extends BaseBuilder {
  constructor(
    private actionName: string,
    private inputType: string,
    private outputType: string,
  ) {
    super();
  }

  override ensure(sourceFile: import('ts-morph').SourceFile): void {
    const cls = sourceFile.getClass(this.actionName);
    if (cls) {
      const method = cls.getMethod('run') || cls.getStaticMethod('run');
      if (method) {
        const body = method.getBodyText();
        if (body && (body.includes('error: any') || body.includes('as any'))) {
          const cleaned = this.cleanBody(body);
          if (cleaned !== body) {
            method.setBodyText(cleaned);
          }
        }
      }
    }
    super.ensure(sourceFile);
  }

  private cleanBody(body: string): string {
    return body
      .replace(/error:\s*any/g, 'error: unknown')
      .replace(/undefined\s+as\s+any/g, `{} as unknown as ${this.outputType}`)
      .replace(/}\s+as\s+any/g, `} as unknown as ${this.outputType}`);
  }

  protected getSchema(node?: NodeContainer): FileDefinition {
    const capturedReturnType = `Promise<ServiceResponse<${this.outputType}>>`;
    const cls = node && 'getClass' in node ? node.getClass(this.actionName) : undefined;
    const method = cls ? cls.getMethod('run') || cls.getStaticMethod('run') : undefined;
    const body = method?.getBodyText();
    const existingStatements = body ? [ts`${this.cleanBody(body)}`] : undefined;

    const runMethod: MethodConfig = {
      name: 'run',
      isStatic: true,
      isAsync: true,
      returnType: capturedReturnType,
      parameters: [
        { name: this.inputType === 'void' ? '_input' : 'input', type: this.inputType },
        { name: 'context', type: 'APIContext' },
      ],
      statements: existingStatements || [
        TemplateLoader.load('action/run.tsf', { outputType: this.outputType }),
      ],
    };

    const actionClass: ClassDefinition = {
      name: this.actionName,
      isExported: true,
      methods: [runMethod],
    };

    const namedImports = [this.inputType, this.outputType]
      .map((t) => t.replace('[]', '').trim())
      .filter((t) => {
        const normalized = t.toLowerCase();
        return ![
          'string',
          'number',
          'boolean',
          'void',
          'unknown',
          'never',
          'undefined',
          'object',
          'null',
          'date',
        ].includes(normalized);
      });

    const imports: ImportConfig[] = [
      { moduleSpecifier: '@/types/service', namedImports: ['ServiceResponse'], isTypeOnly: true },
      { moduleSpecifier: 'astro', namedImports: ['APIContext'], isTypeOnly: true },
    ];

    let sourceText = '';
    if (node && 'getFullText' in node) {
      sourceText = (node as { getFullText(): string }).getFullText();
    } else if (existingStatements) {
      sourceText = existingStatements
        .map((s) =>
          typeof s === 'string'
            ? s
            : s && typeof s === 'object' && 'raw' in s
              ? (s as ParsedStatement).raw
              : '',
        )
        .join('\n');
    }

    const hasOrchestrationService = sourceText.includes('OrchestrationService');
    if (hasOrchestrationService) {
      imports.push({
        moduleSpecifier: '../services/orchestration-service',
        namedImports: ['OrchestrationService'],
      });
    }

    const hasJobMetricsService = sourceText.includes('JobMetricsService');
    if (hasJobMetricsService) {
      imports.push({
        moduleSpecifier: '../services/job-metrics-service',
        namedImports: ['JobMetricsService'],
      });
    }

    const hasAgentService = sourceText.includes('AgentService');
    if (hasAgentService) {
      imports.push({
        moduleSpecifier: '../services/agent-service',
        namedImports: ['AgentService'],
      });
    }

    const hasApiActor = sourceText
      .split('\n')
      .some((line) => !line.trim().startsWith('import') && line.includes('ApiActor'));
    if (hasApiActor) {
      imports.push({
        moduleSpecifier: '@/lib/api/api-docs',
        namedImports: ['ApiActor'],
        isTypeOnly: true,
      });
    }

    const hasZod = sourceText.includes('z.');
    if (hasZod) {
      imports.push({
        moduleSpecifier: 'zod',
        namedImports: ['z'],
      });
    }

    const hasTeamRole = sourceText.includes('TeamRole');
    if (hasTeamRole && !namedImports.includes('TeamRole')) {
      namedImports.push('TeamRole');
    }

    const hasHookSystem = sourceText.includes('HookSystem');
    if (hasHookSystem) {
      imports.push({
        moduleSpecifier: '@/lib/modules/hooks',
        namedImports: ['HookSystem'],
      });
    }

    const hasAuthService = sourceText.includes('AuthService');
    if (hasAuthService) {
      imports.push({
        moduleSpecifier: '../services/auth-service',
        namedImports: ['AuthService'],
      });
    }

    const hasBcrypt = sourceText.includes('bcrypt');
    if (hasBcrypt) {
      imports.push({
        moduleSpecifier: 'bcryptjs',
        defaultImport: 'bcrypt',
      });
    }

    const cleanBodyText = sourceText
      .split('\n')
      .filter((line) => !line.trim().startsWith('import'))
      .join('\n');
    const hasDb = cleanBodyText.includes('db.') || cleanBodyText.includes(' db ');
    const alreadyImportsDb = sourceText.includes('@/lib/core/db');

    if (hasDb && !alreadyImportsDb) {
      imports.push({
        moduleSpecifier: '@/lib/core/db',
        namedImports: ['db'],
      });
    }

    if (namedImports.length > 0) {
      // Deduplicate imports
      const uniqueImports = [...new Set(namedImports)];
      if (uniqueImports.length > 0) {
        imports.push({
          moduleSpecifier: '../sdk/types',
          namedImports: uniqueImports,
          isTypeOnly: !uniqueImports.includes('TeamRole'),
        });
      }
    }

    // Preserve existing manual imports
    const existingImports = this.getExistingImports(node);
    const importMap = new Map<string, ImportConfig>();

    // Add generated imports first
    imports.forEach((imp) => importMap.set(imp.moduleSpecifier, imp));

    // Add existing imports if not already present or merge named imports
    existingImports.forEach((existing) => {
      const existingSpecifier = existing.moduleSpecifier;
      if (importMap.has(existingSpecifier)) {
        const generated = importMap.get(existingSpecifier)!;
        if (existing.namedImports && generated.namedImports) {
          const mergedNames = [...new Set([...generated.namedImports, ...existing.namedImports])];
          generated.namedImports = mergedNames;
          generated.isTypeOnly = generated.isTypeOnly && existing.isTypeOnly;
        }
      } else {
        importMap.set(existingSpecifier, existing);
      }
    });

    // Merge imports
    const finalImports = Array.from(importMap.values());

    // Cleanup ApiActor if not used
    if (!hasApiActor) {
      finalImports.forEach((imp) => {
        if (imp.namedImports?.includes('ApiActor')) {
          imp.namedImports = imp.namedImports.filter((n) => n !== 'ApiActor');
        }
      });
    }

    return {
      header:
        '// GENERATED CODE - THE SIGNATURE IS MANAGED BY THE GENERATOR. YOU MAY MODIFY THE IMPLEMENTATION AND ADD CUSTOM IMPORTS.',
      imports: finalImports.filter((imp) => !imp.namedImports || imp.namedImports.length > 0),
      classes: [actionClass],
    };
  }
}
