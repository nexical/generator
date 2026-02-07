import { Project, SourceFile } from 'ts-morph';
import { UiBaseBuilder } from './ui/ui-base-builder.js';
import { type FileDefinition, type ModelDef, type ModuleConfig } from '../types.js';
import { Reconciler } from '../reconciler.js';
import { toCamelCase, toKebabCase, toPascalCase } from '../../utils/string.js';
import { ts } from '../primitives/statements/factory.js';

export class QueryBuilder extends UiBaseBuilder {
  constructor(
    protected moduleName: string,
    protected config: ModuleConfig,
  ) {
    super(moduleName, config);
  }

  async build(project: Project, sourceFile: SourceFile | undefined): Promise<void> {
    // 1. Load UI Config
    this.loadUiConfig();

    // 2. Resolve Backend Models
    const models = this.resolveModels();
    if (!models || models.length === 0) return;

    // 3. Generate Hooks for each model
    for (const model of models) {
      if (!model.api) continue; // Only generate for API-exposed models

      const hookFile = project.createSourceFile(
        `src/hooks/use-${toKebabCase(model.name)}.tsx`,
        '',
        { overwrite: true },
      );

      const definition: FileDefinition = {
        header: this.getHeader(),
        imports: [
          {
            moduleSpecifier: '@tanstack/react-query',
            namedImports: ['useQuery', 'useMutation', 'useQueryClient'],
          },
          {
            moduleSpecifier: '@/lib/api', // Assumes global api client
            namedImports: ['api'],
          },
        ],
        functions: [
          this.generateUseQuery(model),
          this.generateUseCreate(model),
          this.generateUseUpdate(model),
          this.generateUseDelete(model),
        ],
      };

      Reconciler.reconcile(hookFile, definition);
    }

    // 4. Generate Hooks for Custom Actions
    const routes = this.resolveRoutes();
    for (const r of routes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const route = r as any;
      const actionName = route.action || `${route.verb}${route.modelName}${route.path}`; // simplified fallback

      const hookName = `use${toPascalCase(actionName)}`;
      const fileName = `src/hooks/use-${toKebabCase(actionName)}.tsx`;

      const hookFile = project.createSourceFile(fileName, '', { overwrite: true });

      const definition: FileDefinition = {
        header: this.getHeader(),
        imports: [
          {
            moduleSpecifier: '@tanstack/react-query',
            namedImports: ['useMutation', 'useQueryClient'],
          },
          {
            moduleSpecifier: '@/lib/api',
            namedImports: ['api'],
          },
        ],
        variables: [
          {
            name: hookName,
            isExported: true,
            declarationKind: 'const',
            initializer: this.generateCustomActionHook(route),
          },
        ],
      };
      Reconciler.reconcile(hookFile, definition);
    }
  }

  private generateUseQuery(model: ModelDef) {
    const modelName = toPascalCase(model.name);
    const kebabName = toKebabCase(model.name);
    return {
      name: `use${modelName}Query`,
      isExported: true,
      parameters: [],
      statements: [
        ts`return useQuery({ queryKey: ['${kebabName}', 'list'], queryFn: () => api.${toCamelCase(model.name)}.findMany() });`,
      ],
    };
  }

  private generateUseCreate(model: ModelDef) {
    const modelName = toPascalCase(model.name);
    return {
      name: `useCreate${modelName}`,
      isExported: true,
      statements: [
        ts`const queryClient = useQueryClient();`,
        ts`return useMutation({ mutationFn: (data: unknown) => api.${toCamelCase(model.name)}.create(data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['${toKebabCase(model.name)}'] }) });`,
      ],
    };
  }

  private generateUseUpdate(model: ModelDef) {
    const modelName = toPascalCase(model.name);
    return {
      name: `useUpdate${modelName}`,
      isExported: true,
      statements: [
        ts`const queryClient = useQueryClient();`,
        ts`return useMutation({ mutationFn: ({ id, data }: { id: string, data: unknown }) => api.${toCamelCase(model.name)}.update(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['${toKebabCase(model.name)}'] }) });`,
      ],
    };
  }

  private generateUseDelete(model: ModelDef) {
    const modelName = toPascalCase(model.name);
    return {
      name: `useDelete${modelName}`,
      isExported: true,
      statements: [
        ts`const queryClient = useQueryClient();`,
        ts`return useMutation({ mutationFn: (id: string) => api.${toCamelCase(model.name)}.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['${toKebabCase(model.name)}'] }) });`,
      ],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private generateCustomActionHook(route: any) {
    const camelModel = toCamelCase(route.modelName);
    const sdkMethod = toCamelCase(route.action || `${route.verb}${route.modelName}`);

    return ts`() => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: unknown) => (api as Record<string, Record<string, (data: unknown) => Promise<unknown>>>).${camelModel}.${sdkMethod}(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['${toKebabCase(route.modelName)}'] })
    });
}`;
  }

  private getHeader(): string {
    return '// GENERATED CODE - DO NOT MODIFY\n// This file was generated by the QueryBuilder.';
  }
}
