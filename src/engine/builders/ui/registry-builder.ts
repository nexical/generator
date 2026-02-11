import { Project, SourceFile } from 'ts-morph';
import { UiBaseBuilder } from './ui-base-builder.js';
import { type FileDefinition, type ModuleConfig } from '../../types.js';
import { Reconciler } from '../../reconciler.js';
import { toKebabCase } from '../../../utils/string.js';

export class RegistryBuilder extends UiBaseBuilder {
  constructor(
    protected moduleName: string,
    protected config: ModuleConfig,
    protected modulePath: string,
  ) {
    super(moduleName, config, modulePath);
  }

  async build(project: Project, sourceFile: SourceFile | undefined): Promise<void> {
    this.loadUiConfig();

    if (!this.uiConfig.registries) {
      // No registries to generate
      return;
    }

    // Iterate through each zone and its items
    for (const [zone, items] of Object.entries(this.uiConfig.registries)) {
      for (const item of items) {
        this.generateRegistryItem(project, zone, item);
      }
    }
  }

  private generateRegistryItem(
    project: Project,
    zone: string,
    item: {
      name: string;
      priority: number;
      component: string;
      guard: string[];
      matcher: Record<string, unknown>;
    },
  ) {
    const fileName = `${item.priority}-${toKebabCase(item.name)}.tsx`;
    const filePath = `src/registry/${zone}/${fileName}`;

    const file = project.createSourceFile(filePath, '', { overwrite: true });

    // Extract component name and path from the component string
    const componentPath = item.component;
    const componentName = this.extractComponentName(componentPath);

    const definition: FileDefinition = {
      header: this.getHeader(),
      imports: [
        {
          moduleSpecifier: componentPath,
          namedImports: [componentName],
        },
      ],
      variables: [],
    };

    // Add auth hook import if guards are present
    if (item.guard && item.guard.length > 0) {
      definition.imports?.push({
        moduleSpecifier: '@/hooks/use-auth',
        namedImports: ['useAuth'],
      });
    }

    // Add shell context hook import if matcher is present
    if (item.matcher && Object.keys(item.matcher).length > 0) {
      definition.imports?.push({
        moduleSpecifier: '@/hooks/use-shell-context',
        namedImports: ['useShellContext'],
      });
    }

    // Generate the component body
    const componentBody = this.generateComponentBody(componentName, item.guard, item.matcher);

    definition.variables?.push({
      name: 'RegistryItem',
      isExported: true,
      declarationKind: 'const',
      initializer: componentBody,
    });

    Reconciler.reconcile(file, definition);
  }

  private generateComponentBody(
    componentName: string,
    guard: string[],
    matcher: Record<string, unknown>,
  ): string {
    const lines: string[] = [];

    lines.push('function RegistryItem() {');

    // Add hooks
    const hasGuard = guard && guard.length > 0;
    const hasMatcher = matcher && Object.keys(matcher).length > 0;

    if (hasGuard) {
      lines.push('  const { user } = useAuth();');
    }

    if (hasMatcher) {
      lines.push('  const { url } = useShellContext();');
    }

    // Add guard check
    if (hasGuard) {
      const rolesArray = JSON.stringify(guard);
      lines.push('');
      lines.push('  // Guard check');
      lines.push(`  if (!user || !${rolesArray}.some(role => user.roles.includes(role))) {`);
      lines.push('    return null;');
      lines.push('  }');
    }

    // Add matcher check
    if (hasMatcher) {
      const matcherCondition = this.generateMatcherCondition(matcher);
      lines.push('');
      lines.push('  // Matcher check');
      lines.push(`  if (!(${matcherCondition})) {`);
      lines.push('    return null;');
      lines.push('  }');
    }

    // Return the component
    lines.push('');
    lines.push(`  return <${componentName} />;`);
    lines.push('}');

    return lines.join('\n');
  }

  private generateMatcherCondition(matcher: Record<string, unknown>): string {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(matcher)) {
      if (key === 'path' && typeof value === 'string') {
        conditions.push(this.generatePathMatcher(value));
      } else if (key === 'isMobile' && typeof value === 'boolean') {
        // isMobile would need to come from shell context
        conditions.push(value ? 'ctx.isMobile' : '!ctx.isMobile');
      } else if (typeof value === 'boolean') {
        conditions.push(value ? `ctx.${key}` : `!ctx.${key}`);
      } else if (typeof value === 'string') {
        conditions.push(`ctx.${key} === '${value}'`);
      }
    }

    return conditions.length > 0 ? conditions.join(' && ') : 'true';
  }

  private generatePathMatcher(pattern: string): string {
    // Handle wildcard patterns
    if (pattern === '*') {
      return 'true';
    }

    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return `url.pathname.startsWith('${prefix}')`;
    }

    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      return `url.pathname.endsWith('${suffix}')`;
    }

    // Exact match
    return `url.pathname === '${pattern}'`;
  }

  private extractComponentName(componentPath: string): string {
    // Extract the last part of the path as the component name
    // e.g., '@/components/nav/UserDashboardLink' -> 'UserDashboardLink'
    const parts = componentPath.split('/');
    return parts[parts.length - 1];
  }

  private getHeader(): string {
    return '// GENERATED CODE - DO NOT MODIFY\n// This file was generated by the RegistryBuilder.';
  }
}
