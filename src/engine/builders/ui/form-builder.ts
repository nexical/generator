import { Project, SourceFile } from 'ts-morph';
import { UiBaseBuilder } from './ui-base-builder.js';
import path from 'node:path';
import {
  type FileDefinition,
  type ModelDef,
  type ModuleConfig,
  type JsxElementConfig,
  type JsxExpressionConfig,
  type StatementConfig,
  type FormFieldConfig,
  type FunctionConfig,
} from '../../types.js';
import { Reconciler } from '../../reconciler.js';
import { toKebabCase, toPascalCase } from '../../../utils/string.js';
import { ZodHelper } from '../utils/zod-helper.js';
import { JsxElementPrimitive } from '../../primitives/jsx/element.js';
import { LocaleRegistry } from '../../locales/locale-registry.js';

export class FormBuilder extends UiBaseBuilder {
  constructor(
    protected moduleName: string,
    protected config: ModuleConfig,
    protected modulePath: string,
  ) {
    super(moduleName, config, modulePath);
  }

  async build(project: Project, sourceFile: SourceFile | undefined): Promise<void> {
    this.loadUiConfig();
    const models = this.resolveModels();
    if (!models || models.length === 0) return;

    // Extract all models for resolving relations in ZodHelper
    const allModels = models;

    for (const model of models) {
      // ONLY generate forms if listed in uiConfig.forms
      if (!this.uiConfig.forms || !this.uiConfig.forms[model.name]) {
        continue;
      }

      const formConfig = this.uiConfig.forms[model.name];

      if (!model.api) continue;

      const componentName = `${toPascalCase(model.name)}Form`;
      const fileName = path.join(this.modulePath, 'src/components', `${componentName}.tsx`);

      const file = project.createSourceFile(fileName, '', { overwrite: true });

      // Collect custom component imports
      const customImports: Set<string> = new Set();
      Object.values(formConfig).forEach((fieldConfig: FormFieldConfig) => {
        if (fieldConfig.component && fieldConfig.component.path) {
          // We need to handle named imports. Assuming component.name is the named export.
          // Store as JSON string to dedupe, then parse back.
          customImports.add(
            JSON.stringify({
              moduleSpecifier: fieldConfig.component.path,
              namedImports: [fieldConfig.component.name],
            }),
          );
        }
      });

      const imports = [
        {
          moduleSpecifier: 'react',
          namedImports: ['useEffect'],
        },
        {
          moduleSpecifier: 'react-i18next',
          namedImports: ['useTranslation'],
        },
        {
          moduleSpecifier: 'react-hook-form',
          namedImports: ['useForm'],
        },
        {
          moduleSpecifier: '@hookform/resolvers/zod',
          namedImports: ['zodResolver'],
        },
        {
          moduleSpecifier: 'zod',
          namedImports: ['z'],
        },
        {
          moduleSpecifier: `../hooks/use-${toKebabCase(model.name)}`,
          namedImports: [
            `useCreate${toPascalCase(model.name)}`,
            `useUpdate${toPascalCase(model.name)}`,
          ],
        },
        {
          moduleSpecifier: '@/lib/api',
          namedImports: [this.getModuleTypeName()],
        },
        {
          moduleSpecifier: '../lib/permissions',
          namedImports: ['Permission'],
        },
        {
          moduleSpecifier: '@/lib/ui/nav-context',
          namedImports: ['useNavData'],
        },
      ];

      // Add custom imports
      customImports.forEach((json) => {
        imports.push(JSON.parse(json));
      });

      const definition: FileDefinition = {
        header: this.getHeader(),
        imports: imports,
        functions: [this.generateFunctionConfig(model, allModels, componentName, formConfig)],
      };

      Reconciler.reconcile(file, definition);
    }
  }

  private generateFunctionConfig(
    model: ModelDef,
    allModels: ModelDef[],
    componentName: string,
    formConfig: Record<string, FormFieldConfig>,
  ): FunctionConfig {
    const modelName = toPascalCase(model.name);
    const zodSchema = ZodHelper.generateSchema(model, allModels);

    // Register generic button keys
    const keys = {
      saving: LocaleRegistry.register('common.status.saving', 'Saving...'),
      update: LocaleRegistry.register('common.actions.update', 'Update'),
      create: LocaleRegistry.register('common.actions.create', 'Create'),
    };

    const statements: StatementConfig[] = [
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [{ name: '{ t }', initializer: 'useTranslation()' }],
      },
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [
          { name: 'isEdit', initializer: '!!id' },
          { name: 'createMutation', initializer: `useCreate${modelName}()` },
          { name: 'updateMutation', initializer: `useUpdate${modelName}()` },
        ],
      },
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [
          { name: '{ context }', initializer: 'useNavData()' },
          { name: 'user', initializer: 'context?.user' },
          { name: 'SiteRole', initializer: `${this.getModuleTypeName()}.SiteRole` },
          { name: 'UserStatus', initializer: `${this.getModuleTypeName()}.UserStatus` },
        ],
      },
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [
          {
            name: 'canCreate',
            initializer: `Permission.check('${model.name.toLowerCase()}:create', user?.role || 'ANONYMOUS')`,
          },
          {
            name: 'canUpdate',
            initializer: `Permission.check('${model.name.toLowerCase()}:update', user?.role || 'ANONYMOUS')`,
          },
        ],
      },
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [{ name: 'schema', initializer: zodSchema }],
      },
      {
        raw: 'type FormData = z.infer<typeof schema>;',
        getNodes: () => [],
      },
      // Hook form raw statement for now as it's complex destructuring
      {
        raw: `const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors, isSubmitting },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: initialData || {},
    });`,
        getNodes: () => [],
      },
      {
        raw: `useEffect(() => {
        if (initialData) {
            reset(initialData);
        }
    }, [initialData, reset]);`,
        getNodes: () => [],
      },
      {
        raw: `const onSubmit = (data: FormData) => {
        if (isEdit && id) {
            updateMutation.mutate({ id, data }, { onSuccess });
        } else {
            createMutation.mutate(data, { onSuccess });
        }
    };`,
        getNodes: () => [],
      },
    ];

    // Build JSX Fields
    const fieldElements = this.generateFieldElements(model, formConfig);

    // Submit Button
    const submitButton: JsxElementConfig = {
      kind: 'jsx',
      tagName: 'button',
      attributes: [
        { name: 'type', value: 'submit' },
        { name: 'disabled', value: { kind: 'expression', expression: 'isSubmitting' } },
        {
          name: 'className',
          value: 'btn-primary btn-dims-default w-full sm:w-auto',
        },
      ],
      children: [
        {
          kind: 'expression',
          expression: `isSubmitting ? t('${keys.saving}') : (isEdit ? t('${keys.update}') : t('${keys.create}'))`,
        },
      ],
    };

    // Wrap button in permission logic
    const conditionalButton: JsxExpressionConfig = {
      kind: 'expression',
      expression:
        '(isEdit ? canUpdate : canCreate) && ' + new JsxElementPrimitive(submitButton).generate(),
    };

    statements.push({
      kind: 'return',
      expression: {
        kind: 'jsx',
        tagName: 'form',
        attributes: [
          { name: 'onSubmit', value: { kind: 'expression', expression: 'handleSubmit(onSubmit)' } },
          { name: 'className', value: 'space-y-4 form-container' },
        ],
        children: [...fieldElements, conditionalButton],
      },
    });

    return {
      name: componentName,
      isExported: true,
      parameters: [
        {
          name: '{ id, initialData, onSuccess }',
          type: `{ id?: string, initialData?: ${this.getModuleTypeName()}.${toPascalCase(
            model.name,
          )}, onSuccess?: () => void }`,
        },
      ],
      statements,
    };
  }

  private generateFieldElements(
    model: ModelDef,
    formConfig: Record<string, FormFieldConfig>,
  ): JsxElementConfig[] {
    const lowerModelName = model.name.toLowerCase();

    return Object.entries(model.fields)
      .filter(
        ([name, f]) =>
          // Include if not private OR if explicitly configured in formConfig
          (!f.private || (formConfig && formConfig[name])) &&
          f.type !== 'Json' &&
          !f.isRelation &&
          !['id', 'createdAt', 'updatedAt'].includes(name),
      )
      .map(([name, f]) => {
        // Register field label
        const key = LocaleRegistry.register(
          `module.${lowerModelName}.field.${name}`,
          toPascalCase(name)
            .replace(/([A-Z])/g, ' $1')
            .trim(),
        );

        // Check for Custom Component Override
        const fieldConfig = formConfig[name];
        if (fieldConfig && fieldConfig.component) {
          return {
            kind: 'jsx',
            tagName: 'div',
            children: [
              {
                kind: 'jsx',
                tagName: 'label',
                attributes: [
                  { name: 'htmlFor', value: name },
                  { name: 'className', value: 'input-label' },
                ],
                children: [{ kind: 'expression', expression: `t('${key}')` }],
              },
              {
                kind: 'jsx',
                tagName: 'div',
                attributes: [{ name: 'className', value: 'mt-1' }],
                children: [
                  {
                    kind: 'jsx',
                    tagName: fieldConfig.component.name,
                    selfClosing: true,
                    attributes: [
                      { name: 'id', value: name },
                      {
                        name: 'error',
                        value: {
                          kind: 'expression',
                          expression: `errors.${name}?.message as string`,
                        },
                      },
                      // Spread register props correctly
                      { name: `{...register('${name}')}` },
                      // Allow props injection if needed, but for now assumption is standard interface
                    ],
                  },
                ],
              },
            ],
          };
        }

        let inputType = 'text';
        if (f.type === 'Int' || f.type === 'Float') inputType = 'number';
        if (f.type === 'Boolean') inputType = 'checkbox';
        if (f.type === 'DateTime') inputType = 'datetime-local';

        // Standard Input
        return {
          kind: 'jsx',
          tagName: 'div',
          attributes: [{ name: 'className', value: 'form-group space-y-group' }],
          children: [
            {
              kind: 'jsx',
              tagName: 'label',
              attributes: [
                { name: 'htmlFor', value: name },
                { name: 'className', value: 'input-label' },
              ],
              children: [{ kind: 'expression', expression: `t('${key}')` }],
            },
            {
              kind: 'jsx',
              tagName: 'div',
              attributes: [{ name: 'className', value: 'mt-1' }],
              children: [
                {
                  kind: 'jsx',
                  tagName: 'input',
                  selfClosing: true,
                  attributes: [
                    { name: 'type', value: inputType },
                    { name: 'id', value: name },
                    {
                      name: `{...register('${name}'${inputType === 'number' ? ', { valueAsNumber: true }' : ''})}`,
                    },
                    {
                      name: 'className',
                      value: 'input-field w-full',
                    },
                  ],
                },
              ],
            },
            {
              kind: 'expression',
              expression: `errors.${name} && <p className="feedback-error-text mt-2">{errors.${name}?.message as string}</p>`,
            },
          ],
        };
      });
  }

  private getHeader(): string {
    return '// GENERATED CODE - DO NOT MODIFY\n// This file was generated by the FormBuilder.';
  }
}
