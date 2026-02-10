import { Project, SourceFile } from 'ts-morph';
import { UiBaseBuilder } from './ui-base-builder.js';
import path from 'node:path';
import {
  type FileDefinition,
  type ModelDef,
  type ModuleConfig,
  type StatementConfig,
  type FunctionConfig,
} from '../../types.js';
import { Reconciler } from '../../reconciler.js';
import { toKebabCase, toPascalCase } from '../../../utils/string.js';
import { LocaleRegistry } from '../../locales/locale-registry.js';

export class TableBuilder extends UiBaseBuilder {
  constructor(
    protected moduleName: string,
    protected config: ModuleConfig,
  ) {
    super(moduleName, config);
  }

  async build(project: Project, sourceFile: SourceFile | undefined): Promise<void> {
    this.loadUiConfig();
    const models = this.resolveModels();
    if (!models || models.length === 0) return;

    for (const model of models) {
      if (!model.api) continue;

      const componentName = `${toPascalCase(model.name)}Table`;
      const fileName = path.join(
        process.cwd(),
        'modules',
        this.moduleName,
        'src/components',
        `${componentName}.tsx`,
      );

      const file = project.createSourceFile(fileName, '', { overwrite: true });

      // Determine Table Configuration
      const tableConfig = this.uiConfig.tables?.[model.name];
      const editMode = tableConfig?.editMode || 'sheet'; // Default to sheet

      const imports = [
        {
          moduleSpecifier: 'react',
          namedImports: ['useState'],
        },
        {
          moduleSpecifier: 'react-i18next',
          namedImports: ['useTranslation'],
        },
        {
          moduleSpecifier: `@/hooks/use-${toKebabCase(model.name)}`,
          namedImports: [
            `use${toPascalCase(model.name)}Query`,
            `useDelete${toPascalCase(model.name)}`,
          ],
        },
        {
          moduleSpecifier: '@/lib/api',
          namedImports: [this.getModuleTypeName()],
        },
        {
          moduleSpecifier: '@tanstack/react-table',
          namedImports: ['type ColumnDef'],
        },
        {
          moduleSpecifier: '@/components/ui/data-table/data-table',
          namedImports: ['DataTable'],
        },
        {
          moduleSpecifier: '@/components/ui/data-table/data-table-column-header',
          namedImports: ['DataTableColumnHeader'],
        },
        {
          moduleSpecifier: '@/components/ui/button',
          namedImports: ['Button'],
        },
        {
          moduleSpecifier: 'lucide-react',
          namedImports: ['MoreHorizontal', 'Trash', 'Pencil'],
        },
        {
          moduleSpecifier: '@/components/ui/dropdown-menu',
          namedImports: [
            'DropdownMenu',
            'DropdownMenuContent',
            'DropdownMenuItem',
            'DropdownMenuLabel',
            'DropdownMenuSeparator',
            'DropdownMenuTrigger',
          ],
        },
        {
          moduleSpecifier: '@/components/ui/confirm-form-deletion',
          namedImports: ['ConfirmFormDeletion'],
        },
        // Import Form for Editing
        {
          moduleSpecifier: `./${toPascalCase(model.name)}Form`,
          namedImports: [`${toPascalCase(model.name)}Form`],
        },
      ];

      // Import Dialog or Sheet based on editMode
      if (editMode === 'sheet') {
        imports.push({
          moduleSpecifier: '@/components/ui/sheet',
          namedImports: ['Sheet', 'SheetContent', 'SheetHeader', 'SheetTitle', 'SheetDescription'],
        });
      } else {
        imports.push({
          moduleSpecifier: '@/components/ui/dialog',
          namedImports: [
            'Dialog',
            'DialogContent',
            'DialogHeader',
            'DialogTitle',
            'DialogDescription',
            'DialogTrigger',
          ],
        });
      }

      const definition: FileDefinition = {
        header: this.getHeader(),
        imports: imports,
        functions: [this.generateFunctionConfig(model, componentName, editMode)],
      };

      Reconciler.reconcile(file, definition);
    }
  }

  private generateFunctionConfig(
    model: ModelDef,
    componentName: string,
    editMode: 'sheet' | 'dialog',
  ): FunctionConfig {
    const modelName = toPascalCase(model.name);
    const hookName = `use${modelName}Query`;
    const deleteHookName = `useDelete${modelName}`;
    const lowerModelName = model.name.toLowerCase();

    // Register Localization Keys
    const keyPrefix = `module.${lowerModelName}`;
    const keys = {
      loading: LocaleRegistry.register(`common.status.loading`, 'Loading...'),
      editTitle: LocaleRegistry.register(`${keyPrefix}.edit.title`, `Edit ${modelName}`),
      editDesc: LocaleRegistry.register(
        `${keyPrefix}.edit.description`,
        `Make changes to the ${lowerModelName}.`,
      ),
      actionsLabel: LocaleRegistry.register(`common.actions.label`, 'Actions'),
      editAction: LocaleRegistry.register(`common.actions.edit`, 'Edit'),
      deleteAction: LocaleRegistry.register(`common.actions.delete`, 'Delete'),
      columnPrefix: `${keyPrefix}.field`,
    };

    // Fields for columns
    const columns = Object.entries(model.fields)
      .filter(([name, f]) => !f.private && f.type !== 'Json' && !f.isRelation)
      .map(([name]) => {
        // Register column header
        LocaleRegistry.register(`${keys.columnPrefix}.${name}`, toPascalCase(name));
        return name;
      });

    const statements: StatementConfig[] = [
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [{ name: '{ t }', initializer: 'useTranslation()' }],
      },
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [{ name: '{ data, isLoading }', initializer: `${hookName}()` }],
      },
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [{ name: 'deleteMutation', initializer: `${deleteHookName}()` }],
      },
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [{ name: '{ user }', initializer: 'useAuth()' }],
      },
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [
          {
            name: 'canDelete',
            initializer: `Permission.check('${lowerModelName}:delete', user?.role || 'ANONYMOUS')`,
          },
          {
            name: 'canUpdate',
            initializer: `Permission.check('${lowerModelName}:update', user?.role || 'ANONYMOUS')`,
          },
        ],
      },
      // State for Edit/Delete
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [
          {
            name: '[editingItem, setEditingItem]',
            initializer: `useState<${this.getModuleTypeName()}.${modelName} | null>(null)`,
          },
        ],
      },
      {
        kind: 'variable',
        declarationKind: 'const',
        declarations: [
          {
            name: '[deletingItem, setDeletingItem]',
            initializer: `useState<${this.getModuleTypeName()}.${modelName} | null>(null)`,
          },
        ],
      },
      {
        kind: 'if',
        condition: 'isLoading',
        then: {
          kind: 'return',
          expression: {
            kind: 'jsx',
            tagName: 'div',
            attributes: [{ name: 'className', value: 'layout-centered py-12 text-subtle' }],
            children: [{ kind: 'expression', expression: `t('${keys.loading}')` }],
          },
        },
      },
    ];

    // Define columns
    const columnsDefinition = `[
      ${columns
        .map(
          (col) => `{
        accessorKey: '${col}',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('${keys.columnPrefix}.${col}')} />
        ),
        cell: ({ row }) => <div className="text-body-sm">{String(row.getValue('${col}') || '')}</div>,
      }`,
        )
        .join(',\n')},
      {
        id: 'actions',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="btn-icon-sm btn-ghost">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="icon-sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[160px]">
                <DropdownMenuLabel className="text-subtle-xs uppercase">{t('${keys.actionsLabel}')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canUpdate && (
                  <DropdownMenuItem onClick={() => setEditingItem(item)} className="gap-2 cursor-pointer">
                    <Pencil className="icon-xs text-muted-foreground" />
                    {t('${keys.editAction}')}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                    onClick={() => setDeletingItem(item)}
                  >
                    <Trash className="icon-xs" />
                    {t('${keys.deleteAction}')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ]`;

    statements.push({
      kind: 'variable',
      declarationKind: 'const',
      declarations: [
        {
          name: 'columns',
          type: `ColumnDef<${this.getModuleTypeName()}.${modelName}>[]`,
          initializer: columnsDefinition,
        },
      ],
    });

    // Helper to generate Edit Container (Sheet or Dialog)
    const editContainer =
      editMode === 'sheet'
        ? `<Sheet open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
            <SheetContent className="w-dialog-lg sm:max-w-xl">
              <SheetHeader>
                <SheetTitle className="text-heading-md">{t('${keys.editTitle}')}</SheetTitle>
                <SheetDescription className="text-subtle">{t('${keys.editDesc}')}</SheetDescription>
              </SheetHeader>
              <div className="mt-8">
               {editingItem && (
                 <${modelName}Form 
                    id={editingItem.id} 
                    initialData={editingItem} 
                    onSuccess={() => setEditingItem(null)} 
                 />
               )}
              </div>
            </SheetContent>
           </Sheet>`
        : `<Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
            <DialogContent className="w-dialog-md">
              <DialogHeader>
                <DialogTitle className="text-heading-md">{t('${keys.editTitle}')}</DialogTitle>
                <DialogDescription className="text-subtle">{t('${keys.editDesc}')}</DialogDescription>
              </DialogHeader>
              {editingItem && (
                 <${modelName}Form 
                    id={editingItem.id} 
                    initialData={editingItem} 
                    onSuccess={() => setEditingItem(null)} 
                 />
               )}
            </DialogContent>
           </Dialog>`;

    // Return with Data Table AND Modals
    statements.push({
      kind: 'return',
      expression: {
        kind: 'jsx',
        tagName: 'div',
        attributes: [{ name: 'className', value: 'space-y-4 container-admin-table' }],
        children: [
          {
            kind: 'jsx',
            tagName: 'DataTable',
            attributes: [
              { name: 'columns', value: { kind: 'expression', expression: 'columns' } },
              { name: 'data', value: { kind: 'expression', expression: 'data || []' } },
            ],
            selfClosing: true,
          },
          // Edit Modal/Sheet
          {
            kind: 'expression',
            expression: editContainer,
          },
          // Delete Confirmation Dialog
          {
            kind: 'jsx',
            tagName: 'ConfirmFormDeletion',
            selfClosing: true,
            attributes: [
              { name: 'isOpen', value: { kind: 'expression', expression: '!!deletingItem' } },
              {
                name: 'onOpenChange',
                value: {
                  kind: 'expression',
                  expression: '(open) => !open && setDeletingItem(null)',
                },
              },
              { name: 'resourceName', value: `'${modelName}'` },
              {
                name: 'resourceIdentifier',
                value: { kind: 'expression', expression: 'deletingItem?.id || ""' },
              },
              {
                name: 'onConfirm',
                value: {
                  kind: 'expression',
                  expression:
                    '() => { if (deletingItem) deleteMutation.mutate(deletingItem.id); setDeletingItem(null); }',
                },
              },
            ],
          },
        ],
      },
    });

    return {
      name: componentName,
      isExported: true,
      statements,
    };
  }

  private getHeader(): string {
    return '// GENERATED CODE - DO NOT MODIFY\n// This file was generated by the TableBuilder.';
  }
}
