import { Scope, SourceFile, ModuleDeclaration, Project, Statement } from 'ts-morph';

export type NodeContainer = SourceFile | ModuleDeclaration;

export interface ParsedStatement {
  raw: string;
  getNodes(project: Project): Statement[];
  cleanup?(): void;
}

export interface ModelField {
  type: string;
  isRequired: boolean;
  isList: boolean;
  attributes: string[];
  api: boolean; // Default: true
  private?: boolean;
  isEnum?: boolean;
  enumValues?: string[];
  isRelation?: boolean;
  relationTo?: string;
}

export interface ActorConfig {
  name?: string; // e.g. 'user' or 'team-api-key'
  prefix?: string; // e.g. 'sk_user_'
  strategy: 'login' | 'api-key' | 'bearer';
  fields?: Record<string, string>;
  validStatus?: string;
}

export interface ModelDef {
  name: string;
  api: boolean; // Default: true
  db?: boolean; // Default: true (false means Virtual Model / No Prisma)
  default?: boolean; // Default: false
  extended?: boolean; // Default: false (true means this model is owned by another module)
  actor?: ActorConfig;
  fields: Record<string, ModelField>;
  role?: string | Record<string, string>; // Role configuration (string = globally, or map of action -> role)
  test?: {
    actor?: string;
  };
  isExported?: boolean;
}

export interface TestRoleConfig {
  [key: string]: Record<string, string | number | boolean>; // e.g. admin: { role: 'ADMIN' }
}

export interface GlobalConfig {
  test?: {
    roles?: TestRoleConfig;
  };
}

export interface ModuleMetadata {
  name: string;
  description?: string;
}

export interface CustomRoute {
  method: string;
  path: string;
  verb: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  summary?: string;
  input?: string;
  output?: string;
  role?: string; // Role required (default: 'member' typically handled by builder)
  action?: string; // Optional custom action file path/name
}

// --- UI Module Configurations ---

export interface PageDefinition {
  path: string;
  component: string;
  guard: string[];
}

export interface ShellDefinition {
  name: string;
  matcher: Record<string, unknown>; // Map of rules for ShellContext
}

export interface RegistryItemDefinition {
  name: string;
  priority: number;
  component: string;
  guard: string[];
  matcher: Record<string, unknown>;
}

export interface FormFieldConfig {
  component?: {
    name: string;
    path: string;
    props?: Record<string, unknown>; // Optional props to pass
  };
}

export interface TableConfig {
  editMode?: 'sheet' | 'dialog';
}

export interface UiModuleConfig {
  backend?: string;
  prefix?: string;
  pages?: PageDefinition[];
  shells?: ShellDefinition[];
  registries?: Record<string, RegistryItemDefinition[]>;
  forms?: Record<string, Record<string, FormFieldConfig>>; // ModelName -> FieldName -> Config
  tables?: Record<string, TableConfig>; // ModelName -> Config
}

// --- Statement Configurations ---

// --- Statement Configurations ---

export interface BaseStatementConfig {
  isDefault?: boolean; // If true, generator will not overwrite if user has modified matching statement
}

export interface VariableStatementConfig extends BaseStatementConfig {
  kind: 'variable';
  declarationKind: 'const' | 'let' | 'var';
  declarations: {
    name: string;
    type?: string;
    initializer?: string; // string or potentially ExpressionConfig later
  }[];
}

export interface ReturnStatementConfig extends BaseStatementConfig {
  kind: 'return';
  expression: string | JsxElementConfig;
}

export interface ExpressionStatementConfig extends BaseStatementConfig {
  kind: 'expression';
  expression: string;
}

export interface IfStatementConfig extends BaseStatementConfig {
  kind: 'if';
  condition: string;
  then: StatementConfig[] | StatementConfig; // Recursive
  else?: StatementConfig[] | StatementConfig;
}

export interface ThrowStatementConfig extends BaseStatementConfig {
  kind: 'throw';
  expression: string;
}

// TODO: TryCatch is complex, adding placeholder without recursion for now to sync with Primitives later if needed
// Or I can skip TryCatch for Permissions as we primarily need IF/THROW.
// User mentioned Try primitive.
export interface TryStatementConfig extends BaseStatementConfig {
  kind: 'try';
  block: StatementConfig[];
  catchClause?: {
    variableName?: string;
    block: StatementConfig[];
  };
  finallyBlock?: StatementConfig[];
}

// --- JSX Configurations ---

export interface JsxAttributeConfig {
  name: string;
  value?: string | JsxExpressionConfig; // string literal or { expr }
}

export interface JsxExpressionConfig {
  kind: 'expression';
  expression: string;
}

export interface JsxElementConfig extends BaseStatementConfig {
  kind: 'jsx';
  tagName: string;
  attributes?: JsxAttributeConfig[];
  children?: (string | JsxElementConfig | JsxExpressionConfig)[];
  selfClosing?: boolean;
}

export type StatementConfig =
  | ParsedStatement
  | VariableStatementConfig
  | ReturnStatementConfig
  | ExpressionStatementConfig
  | IfStatementConfig
  | ThrowStatementConfig
  | TryStatementConfig
  | JsxElementConfig; // Allow valid JSX as a statement

// --- Primitive Configurations ---

export interface DecoratorConfig {
  name: string;
  arguments?: string[];
}

export interface MethodConfig {
  name: string;
  isStatic?: boolean;
  isAsync?: boolean;
  returnType?: string;
  parameters?: { name: string; type: string; optional?: boolean; decorators?: DecoratorConfig[] }[];
  statements?: StatementConfig[];
  scope?: Scope;
  decorators?: DecoratorConfig[];
  docs?: string[];
}

export interface ClassConfig {
  name: string;
  isExported?: boolean;
  isAbstract?: boolean;
  extends?: string;
  implements?: string[];
  decorators?: DecoratorConfig[];
  docs?: string[];
}

export interface ImportConfig {
  moduleSpecifier: string;
  defaultImport?: string;
  namedImports?: string[];
  isTypeOnly?: boolean;
}

export interface ExportConfig {
  moduleSpecifier?: string;
  exportClause?: string | string[];
  isTypeOnly?: boolean;
}

// --- Access and Role Configurations ---

export interface RoleDefinition {
  description?: string;
  inherits?: string[];
  permissions?: string[];
}

export interface PermissionDefinition {
  description: string;
}

export interface AccessConfig {
  roles: Record<string, RoleDefinition>;
  permissions: Record<string, PermissionDefinition>;
  guards?: Record<string, string[]>;
}

export interface RoleConfig {
  name: string; // The specific role name, e.g. 'ADMIN'
  definition: RoleDefinition;
  isDefault?: boolean;
}

// --- Declarative Schema ---

export interface PropertyConfig {
  name: string;
  type: string;
  optional?: boolean;
  readonly?: boolean;
  isStatic?: boolean;
  initializer?: string | ParsedStatement;
  scope?: Scope;
  decorators?: DecoratorConfig[];
  docs?: string[];
}

export interface AccessorConfig {
  name: string;
  kind: 'get' | 'set';
  scope?: Scope;
  isStatic?: boolean;
  returnType?: string; // for get
  parameters?: { name: string; type: string; decorators?: DecoratorConfig[] }[]; // for set
  statements?: StatementConfig[];
  decorators?: DecoratorConfig[];
  docs?: string[];
}

export interface ConstructorConfig {
  parameters?: {
    name: string;
    type: string;
    optional?: boolean;
    scope?: Scope;
    decorators?: DecoratorConfig[];
  }[];
  statements?: StatementConfig[];
}

export interface InterfaceConfig {
  name: string;
  isExported?: boolean;
  extends?: string[];
  properties?: PropertyConfig[];
  comments?: string[];
}

export interface ClassDefinition extends ClassConfig {
  methods?: MethodConfig[];
  properties?: PropertyConfig[];
  constructorDef?: ConstructorConfig;
  accessors?: AccessorConfig[];
}

export interface EnumMemberConfig {
  name: string;
  value: string | number;
}

export interface EnumConfig {
  name: string;
  isExported?: boolean;
  members: EnumMemberConfig[];
}

export interface FunctionConfig {
  name: string;
  isExported?: boolean;
  isAsync?: boolean;
  overwriteBody?: boolean;
  returnType?: string;
  parameters?: { name: string; type: string; optional?: boolean }[];
  statements?: StatementConfig[];
}

export interface TypeConfig {
  name: string;
  isExported?: boolean;
  type: string;
}

export interface VariableConfig {
  name: string;
  type?: string;
  initializer?: string | ParsedStatement;
  declarationKind?: 'const' | 'let' | 'var';
  isExported?: boolean;
}

export interface ModuleConfig {
  name: string;
  isExported?: boolean;
  isDeclaration?: boolean;
  statements?: StatementConfig[];
  imports?: ImportConfig[];
  classes?: ClassDefinition[];
  interfaces?: InterfaceConfig[];
  enums?: EnumConfig[];
  functions?: FunctionConfig[];
  types?: TypeConfig[];
  variables?: VariableConfig[];
  modules?: ModuleConfig[]; // Recursive
  exports?: ExportConfig[];
}

export interface FileDefinition {
  header?: string;
  imports?: ImportConfig[];
  exports?: ExportConfig[];
  statements?: StatementConfig[]; // Added raw statements support
  classes?: ClassDefinition[];
  interfaces?: InterfaceConfig[];
  enums?: EnumConfig[];
  functions?: FunctionConfig[];
  types?: TypeConfig[];
  variables?: VariableConfig[];
  components?: ComponentConfig[];
  modules?: ModuleConfig[];
  role?: RoleConfig; // Configuration for generating a Role class
  permissions?: Record<string, PermissionDefinition>; // Configuration for generating a Permission Registry
  rolePermissions?: Record<string, string[]>; // Map of Role -> Permissions for the check logic
}

export interface ComponentProp {
  name: string;
  type: string;
}

export interface ComponentConfig {
  name: string;
  isExported?: boolean;
  isDefaultExport?: boolean;
  props?: ComponentProp[];
  // The render logic, loaded via TemplateLoader (returns a ReturnStatement with JSX)
  render: ParsedStatement;
}
