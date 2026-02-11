import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import { UiBaseBuilder } from './ui-base-builder.js';
import { type ModuleConfig } from '../../types.js';
import { toPascalCase } from '../../../utils/string.js';

export class ShellBuilder extends UiBaseBuilder {
  constructor(
    protected moduleName: string,
    protected config: ModuleConfig,
    protected modulePath: string,
  ) {
    super(moduleName, config, modulePath);
  }

  async build(project: Project, sourceFile: SourceFile | undefined): Promise<void> {
    this.loadUiConfig();

    if (!this.uiConfig.shells || this.uiConfig.shells.length === 0) {
      // No shells to register
      return;
    }

    // Get or create src/init.ts in the module
    const initPath = 'src/init.ts';
    let initFile = project.getSourceFile(initPath);

    if (!initFile) {
      initFile = project.createSourceFile(initPath, '', { overwrite: false });
    }

    // Process each shell definition
    for (const shell of this.uiConfig.shells) {
      this.registerShell(initFile, shell);
    }
  }

  private registerShell(
    file: SourceFile,
    shell: { name: string; matcher: Record<string, unknown> },
  ) {
    const componentName = toPascalCase(shell.name);
    const componentPath = `./components/shells/${componentName}`;

    // Add import for ShellRegistry if not present
    const shellRegistryImport = file.getImportDeclaration('@/lib/registries/shell-registry');
    if (!shellRegistryImport) {
      file.addImportDeclaration({
        moduleSpecifier: '@/lib/registries/shell-registry',
        namedImports: ['ShellRegistry'],
      });
    }

    // Add import for the shell component if not present
    const componentImport = file.getImportDeclaration(componentPath);
    if (!componentImport) {
      file.addImportDeclaration({
        moduleSpecifier: componentPath,
        namedImports: [componentName],
      });
    }

    // Generate matcher predicate
    const matcherCode = this.generateMatcherPredicate(shell.matcher);

    // Check if registration already exists
    const registrationCall = this.findRegistrationCall(file, shell.name);

    if (registrationCall) {
      // Update existing registration
      const args = registrationCall.getArguments();
      if (args.length >= 3) {
        // Update the matcher (third argument)
        args[2].replaceWithText(matcherCode);
      }
    } else {
      // Add new registration
      file.addStatements(
        `\nShellRegistry.register('${shell.name}', ${componentName}, ${matcherCode});`,
      );
    }
  }

  private findRegistrationCall(file: SourceFile, shellName: string) {
    const callExpressions = file.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      const expr = call.getExpression();
      if (expr.getText() === 'ShellRegistry.register') {
        const args = call.getArguments();
        if (args.length > 0) {
          const firstArg = args[0].getText();
          // Remove quotes from string literal
          const name = firstArg.replace(/['"]/g, '');
          if (name === shellName) {
            return call;
          }
        }
      }
    }

    return undefined;
  }

  private generateMatcherPredicate(matcher: Record<string, unknown>): string {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(matcher)) {
      if (key === 'path' && typeof value === 'string') {
        conditions.push(this.generatePathMatcher(value));
      } else if (key === 'isMobile' && typeof value === 'boolean') {
        conditions.push(value ? 'ctx.isMobile' : '!ctx.isMobile');
      } else if (typeof value === 'boolean') {
        conditions.push(value ? `ctx.${key}` : `!ctx.${key}`);
      } else if (typeof value === 'string') {
        conditions.push(`ctx.${key} === '${value}'`);
      }
    }

    if (conditions.length === 0) {
      return '() => true';
    }

    const condition = conditions.join(' && ');
    return `(ctx) => ${condition}`;
  }

  private generatePathMatcher(pattern: string): string {
    // Handle wildcard patterns
    if (pattern === '*') {
      return 'true';
    }

    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return `ctx.url.pathname.startsWith('${prefix}')`;
    }

    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      return `ctx.url.pathname.endsWith('${suffix}')`;
    }

    // Exact match
    return `ctx.url.pathname === '${pattern}'`;
  }
}
