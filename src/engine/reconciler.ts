import {
  SourceFile,
  StatementedNode,
  Node,
  ClassDeclaration,
  InterfaceDeclaration,
  EnumDeclaration,
  FunctionDeclaration,
  TypeAliasDeclaration,
  VariableStatement,
  ModuleDeclaration,
} from 'ts-morph';
import { GeneratorError } from './errors.js';
import {
  type FileDefinition,
  type NodeContainer,
  type StatementConfig,
  type ParsedStatement,
} from './types.js';
import { ImportPrimitive } from './primitives/core/import-manager.js';
import { ExportPrimitive } from './primitives/core/export-manager.js';
import { ClassPrimitive } from './primitives/nodes/class.js';
import { MethodPrimitive } from './primitives/nodes/method.js';
import { InterfacePrimitive } from './primitives/nodes/interface.js';
import { EnumPrimitive } from './primitives/nodes/enum.js';
import { FunctionPrimitive } from './primitives/nodes/function.js';
import { TypePrimitive } from './primitives/nodes/type.js';
import { VariablePrimitive } from './primitives/nodes/variable.js';
import { PropertyPrimitive } from './primitives/nodes/property.js';
import { ConstructorPrimitive } from './primitives/nodes/constructor.js';
import { AccessorPrimitive } from './primitives/nodes/accessor.js';
import { ModulePrimitive } from './primitives/nodes/module.js';
import { ComponentPrimitive } from './primitives/nodes/component.js';
import { RolePrimitive } from './primitives/nodes/role.js';
import { PermissionPrimitive } from './primitives/nodes/permission.js';

import { Normalizer } from '../utils/normalizer.js';

export class Reconciler {
  static reconcile(sourceFile: NodeContainer, definition: FileDefinition): void {
    try {
      // 0. Handle Header
      if (definition.header && 'insertStatements' in sourceFile) {
        const targetHeader = definition.header.trim();
        const sourceFileNode = sourceFile as SourceFile;
        const sourceText = sourceFileNode.getFullText();

        // If the header exists anywhere, remove it to ensure we can "hoist" it to the top
        if (sourceText.includes(targetHeader)) {
          // Normalize existing text by removing all occurrences of the target header
          // and cleaning up leading whitespace to prevent weird gaps at the top
          const updatedText = sourceText.split(targetHeader).join('').trimStart();
          sourceFileNode.replaceWithText(updatedText);
        }

        // Always insert at the very top (index 0)
        const header = definition.header.endsWith('\n')
          ? definition.header
          : `${definition.header}\n`;
        (sourceFile as StatementedNode).insertStatements(0, header);
      }

      // 1. Handle Imports (Only strictly valid on SourceFile, but let's check or just allow primitive to handle it)
      // ImportPrimitive might fail if parent is not SourceFile.
      // Typically imports are top-level only in basic usage, but namespaces can have imports? No, usually not ES imports.
      // Let's check instance.
      if ('getImportDeclarations' in sourceFile) {
        const source = sourceFile as SourceFile;
        const targetConfigs = definition.imports || [];

        // 1a. Ensure required imports exist or are updated
        targetConfigs.forEach((config) => new ImportPrimitive(config).ensure(source));

        // 1b. Prune imports that are no longer in the definition
        // We only prune if it's a GENERATED file (has our marker) to be safe,
        // or if we're in a strictly-managed part of the definition.
        const sourceText = source.getFullText();
        if (sourceText.includes('GENERATED CODE')) {
          source.getImportDeclarations().forEach((decl) => {
            const specifier = decl.getModuleSpecifierValue();
            const normalizedSpecifier = Normalizer.normalizeImport(specifier);

            const isRequired = targetConfigs.some((config) => {
              const targetSpecifier = Normalizer.normalizeImport(config.moduleSpecifier);
              return targetSpecifier === normalizedSpecifier;
            });

            if (!isRequired) {
              console.info(`[Reconciler] Pruning unused import: ${specifier}`);
              decl.remove();
            }
          });
        }
      }

      // --- Pruning Pass (Only for GENERATED files) ---
      const sourceText =
        'getFullText' in sourceFile
          ? (sourceFile as SourceFile | ModuleDeclaration).getFullText()
          : '';
      const isGenerated = sourceText.includes('GENERATED CODE');

      if (isGenerated) {
        // Class Pruning
        if ('getClasses' in sourceFile) {
          const container = sourceFile as StatementedNode;
          const targetNames = definition.classes?.map((c) => c.name) || [];
          [...container.getClasses()].forEach((node: ClassDeclaration) => {
            const name = node.getName();
            if (name && !targetNames.includes(name)) {
              console.info(`[Reconciler] Pruning class: ${name}`);
              node.remove();
            }
          });
        }

        // Interface Pruning
        if ('getInterfaces' in sourceFile) {
          const container = sourceFile as StatementedNode;
          const targetNames = definition.interfaces?.map((i) => i.name) || [];
          [...container.getInterfaces()].forEach((node: InterfaceDeclaration) => {
            const name = node.getName();
            if (name && !targetNames.includes(name)) {
              console.info(`[Reconciler] Pruning interface: ${name}`);
              node.remove();
            }
          });
        }

        // Enum Pruning
        if ('getEnums' in sourceFile) {
          const container = sourceFile as StatementedNode;
          const targetNames = definition.enums?.map((e) => e.name) || [];
          [...container.getEnums()].forEach((node: EnumDeclaration) => {
            const name = node.getName();
            if (name && !targetNames.includes(name)) {
              console.info(`[Reconciler] Pruning enum: ${name}`);
              node.remove();
            }
          });
        }

        // Function Pruning
        if ('getFunctions' in sourceFile) {
          const container = sourceFile as StatementedNode;
          const targetNames = [
            ...(definition.functions?.map((f) => f.name) || []),
            ...(definition.components?.map((c) => c.name) || []),
          ];
          [...container.getFunctions()].forEach((node: FunctionDeclaration) => {
            const name = node.getName();
            if (name && !targetNames.includes(name)) {
              console.info(`[Reconciler] Pruning function: ${name}`);
              node.remove();
            }
          });
        }

        // Type Pruning
        if ('getTypeAliases' in sourceFile) {
          const container = sourceFile as StatementedNode;
          const targetNames = definition.types?.map((t) => t.name) || [];
          [...container.getTypeAliases()].forEach((node: TypeAliasDeclaration) => {
            const name = node.getName();
            if (name && !targetNames.includes(name)) {
              console.info(`[Reconciler] Pruning type: ${name}`);
              node.remove();
            }
          });
        }

        // Variable Pruning
        if ('getVariableStatements' in sourceFile) {
          const container = sourceFile as StatementedNode;
          const targetNames = [
            ...(definition.variables?.map((v) => v.name) || []),
            ...(definition.components?.map((c) => c.name) || []),
          ];
          [...container.getVariableStatements()].forEach((node: VariableStatement) => {
            const declarations = node.getDeclarationList().getDeclarations();
            const names = declarations.map((d) => d.getName());

            const isRequired = names.some((name: string) => targetNames.includes(name));
            if (!isRequired) {
              console.info(`[Reconciler] Pruning variable: ${names.join(', ')}`);
              node.remove();
            }
          });
        }
      }

      // 2. Handle Classes
      definition.classes?.forEach((classDef) => {
        // Extract class-only config
        const { methods, properties, constructorDef, accessors, ...classConfig } = classDef;

        const classPrimitive = new ClassPrimitive(classConfig);
        const classNode = classPrimitive.ensure(sourceFile);

        // Handle Properties
        properties?.forEach((propDef) => new PropertyPrimitive(propDef).ensure(classNode));

        // Handle Constructor
        if (constructorDef) {
          new ConstructorPrimitive(constructorDef).ensure(classNode);
        }

        // Handle Accessors
        accessors?.forEach((accDef) => new AccessorPrimitive(accDef).ensure(classNode));

        // Recursive: Handle Methods
        methods?.forEach((methodDef) => new MethodPrimitive(methodDef).ensure(classNode));
      });

      // 3. Handle Interfaces
      definition.interfaces?.forEach((interfaceDef) =>
        new InterfacePrimitive(interfaceDef).ensure(sourceFile),
      );

      // 4. Handle Enums
      definition.enums?.forEach((enumDef) => new EnumPrimitive(enumDef).ensure(sourceFile));

      // 5. Handle Functions
      definition.functions?.forEach((funcDef) => new FunctionPrimitive(funcDef).ensure(sourceFile));

      // 6. Handle Types
      definition.types?.forEach((typeDef) => new TypePrimitive(typeDef).ensure(sourceFile));

      // 7. Handle Variables
      definition.variables?.forEach((varDef) => new VariablePrimitive(varDef).ensure(sourceFile));

      // 7.5 Handle Components
      definition.components?.forEach((compDef) =>
        new ComponentPrimitive(compDef).ensure(sourceFile),
      );

      // 8. Handle Modules (Namespaces)
      definition.modules?.forEach((modDef) => new ModulePrimitive(modDef).ensure(sourceFile));

      if (definition.role) {
        new RolePrimitive(definition.role).ensure(sourceFile as SourceFile);
      }

      // 10. Handle Permission
      if (definition.permissions) {
        new PermissionPrimitive(definition.permissions, definition.rolePermissions).ensure(
          sourceFile as SourceFile,
        );
      }

      // 8.5 Handle Exports (Processed after major nodes to match conventional end-of-file exports)
      if ('getExportDeclarations' in sourceFile) {
        definition.exports?.forEach((config) =>
          new ExportPrimitive(config).ensure(sourceFile as SourceFile),
        );
      }

      // 9. Handle Raw Statements (Explicitly added for flexibility)
      if ('statements' in definition && Array.isArray(definition.statements)) {
        const rawStatements = (definition.statements as (string | StatementConfig)[]).map((s) => {
          if (typeof s === 'string') return s;
          if ('raw' in s) return (s as ParsedStatement).raw;
          return ''; // Or handle other structural configs if needed
        });

        if ('addStatements' in sourceFile) {
          const sourceText = (sourceFile as unknown as Node).getFullText();
          const normalizedExisting = Normalizer.normalize(sourceText);

          const uniqueStmts: string[] = [];
          let currentNormalizedExisting = normalizedExisting;

          rawStatements.forEach((stmt) => {
            const trimmedStmt = stmt.trim();
            if (!trimmedStmt) return;

            const normalizedStmt = Normalizer.normalize(trimmedStmt);
            if (currentNormalizedExisting.includes(normalizedStmt)) return;

            // Smart check for blocks: extract the "signature" (first meaningful line)
            // e.g. "export enum Status {", "export function foo(", "defineApi("
            const lines = trimmedStmt.split('\n');
            const signature = lines.find((l) => l.trim().length > 0)?.trim();

            if (signature) {
              const normalizedSignature = Normalizer.normalize(signature);
              // For declarations or common patterns, check if the signature already exists
              const isDeclaration =
                /^(export\s+)?(enum|function|class|const|let|interface)\s+/.test(signature);
              const isDefineApi = signature.startsWith('defineApi(');

              if (isDeclaration || isDefineApi) {
                if (currentNormalizedExisting.includes(normalizedSignature)) {
                  console.info(`[Reconciler] Skipping existing block by signature: ${signature}`);
                  return;
                }
              }
            }

            // Fallback: Smart check for describe/it blocks
            const firstLine = lines[0].trim();
            if (firstLine.startsWith('describe(') || firstLine.startsWith('it(')) {
              // Extract the signature: describe('...', () =>
              const signatureMatch = firstLine.match(/^(describe|it)\(['"`]([^'"`]+)['"`]/);
              if (signatureMatch) {
                const searchPattern = `${signatureMatch[1]}("${signatureMatch[2]}"`;
                if (currentNormalizedExisting.includes(searchPattern)) {
                  console.info(`[Reconciler] Skipping existing block: ${signatureMatch[2]}`);
                  return;
                }
              }
            }

            uniqueStmts.push(stmt);
            currentNormalizedExisting += ' ' + normalizedStmt;
          });

          if (uniqueStmts.length > 0) {
            (sourceFile as StatementedNode).addStatements(uniqueStmts);
          }
        }
      }
    } catch (error) {
      const filePath =
        'getFilePath' in sourceFile ? (sourceFile as SourceFile).getFilePath() : 'namespace';
      throw new GeneratorError(
        `Failed to reconcile file: ${filePath} | ${error instanceof Error ? error.message : String(error)}`,
        { filePath },
        error,
      );
    }
  }

  static validate(
    sourceFile: NodeContainer,
    definition: FileDefinition,
  ): import('./primitives/contracts.js').ValidationResult {
    const issues: string[] = [];
    const collect = (result: import('./primitives/contracts.js').ValidationResult) => {
      if (!result.valid) issues.push(...result.issues);
    };

    // 0. Header
    if (definition.header && 'insertStatements' in sourceFile) {
      const headerTrimmed = definition.header.trim();
      const sourceText = (sourceFile as SourceFile).getFullText().trimStart();
      if (!sourceText.startsWith(headerTrimmed)) {
        issues.push('File header mismatch or missing.');
      }
    }

    // 1. Imports
    if ('getImportDeclarations' in sourceFile) {
      definition.imports?.forEach((config) => {
        const primitive = new ImportPrimitive(config);
        const node = primitive.find(sourceFile as SourceFile);
        if (!node) {
          issues.push(`Import '${config.moduleSpecifier}' is missing.`);
        } else {
          collect(primitive.validate(node));
        }
      });
    }

    // 1.5 Validate Exports
    if ('getExportDeclarations' in sourceFile) {
      definition.exports?.forEach((config) => {
        const primitive = new ExportPrimitive(config);
        const node = primitive.find(sourceFile as SourceFile);
        if (!node) {
          issues.push(`Export '${config.moduleSpecifier}' is missing.`);
        } else {
          collect(primitive.validate(node));
        }
      });
    }

    // 2. Validate Classes
    definition.classes?.forEach((classDef) => {
      const { methods, properties, constructorDef, accessors, ...classConfig } = classDef;
      const classPrimitive = new ClassPrimitive(classConfig);

      const classNode = classPrimitive.find(sourceFile);
      if (!classNode) {
        issues.push(`Class '${classConfig.name}' is missing.`);
        return;
      }

      collect(classPrimitive.validate(classNode));

      // Validate Properties
      properties?.forEach((propDef) => {
        const primitive = new PropertyPrimitive(propDef);
        const node = primitive.find(classNode);
        if (!node) {
          issues.push(`Property '${propDef.name}' is missing in ${classConfig.name}.`);
        } else {
          collect(primitive.validate(node));
        }
      });

      // Validate Constructor
      if (constructorDef) {
        const primitive = new ConstructorPrimitive(constructorDef);
        const node = primitive.find(classNode);
        if (!node) {
          issues.push(`Constructor is missing in ${classConfig.name}.`);
        } else {
          collect(primitive.validate(node));
        }
      }

      // Validate Accessors
      accessors?.forEach((accDef) => {
        const primitive = new AccessorPrimitive(accDef);
        const node = primitive.find(classNode);
        if (!node) {
          issues.push(`Accessor '${accDef.name}' is missing in ${classConfig.name}.`);
        } else {
          collect(primitive.validate(node));
        }
      });

      // Recursive: Methods
      methods?.forEach((methodDef) => {
        const methodPrimitive = new MethodPrimitive(methodDef);
        const methodNode = methodPrimitive.find(classNode);
        if (!methodNode) {
          issues.push(`Method '${methodDef.name}' is missing in ${classConfig.name}.`);
        } else {
          collect(methodPrimitive.validate(methodNode));
        }
      });
    });

    // 3. Interfaces
    definition.interfaces?.forEach((interfaceDef) => {
      const primitive = new InterfacePrimitive(interfaceDef);
      const node = primitive.find(sourceFile);
      if (!node) {
        issues.push(`Interface '${interfaceDef.name}' is missing.`);
      } else {
        collect(primitive.validate(node));
      }
    });

    // 4. Enums
    definition.enums?.forEach((enumDef) => {
      const primitive = new EnumPrimitive(enumDef);
      const node = primitive.find(sourceFile);
      if (!node) {
        issues.push(`Enum '${enumDef.name}' is missing.`);
      } else {
        collect(primitive.validate(node));
      }
    });

    // 5. Functions
    definition.functions?.forEach((funcDef) => {
      const primitive = new FunctionPrimitive(funcDef);
      const node = primitive.find(sourceFile);
      if (!node) {
        issues.push(`Function '${funcDef.name}' is missing.`);
      } else {
        collect(primitive.validate(node));
      }
    });

    // 6. Types
    definition.types?.forEach((typeDef) => {
      const primitive = new TypePrimitive(typeDef);
      const node = primitive.find(sourceFile);
      if (!node) {
        issues.push(`Type '${typeDef.name}' is missing.`);
      } else {
        collect(primitive.validate(node));
      }
    });

    // 7. Variables
    definition.variables?.forEach((varDef) => {
      const primitive = new VariablePrimitive(varDef);
      const node = primitive.find(sourceFile);
      if (!node) {
        issues.push(`Variable '${varDef.name}' is missing.`);
      } else {
        collect(primitive.validate(node));
      }
    });

    // 7.5 Components
    definition.components?.forEach((compDef) => {
      const primitive = new ComponentPrimitive(compDef);
      const node = primitive.find(sourceFile);
      if (!node) {
        issues.push(`Component '${compDef.name}' is missing.`);
      } else {
        collect(primitive.validate(node));
      }
    });

    // 8. Modules
    definition.modules?.forEach((modDef) => {
      const primitive = new ModulePrimitive(modDef);
      const node = primitive.find(sourceFile);
      if (!node) {
        issues.push(`Module '${modDef.name}' is missing.`);
      } else {
        collect(primitive.validate(node));
      }
    });

    // 9. Role
    if (definition.role) {
      const primitive = new RolePrimitive(definition.role);
      const node = primitive.find(sourceFile as SourceFile);
      if (!node) {
        issues.push(`Role '${definition.role.name}' is missing.`);
      } else {
        collect(primitive.validate(node));
      }
    }

    // 10. Permission
    if (definition.permissions) {
      const primitive = new PermissionPrimitive(definition.permissions, definition.rolePermissions);
      const node = primitive.find(sourceFile as SourceFile);
      if (!node) {
        issues.push(`PermissionRegistry is missing.`);
      } else {
        collect(primitive.validate(node));
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
