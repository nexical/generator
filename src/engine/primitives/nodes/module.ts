import {
  SourceFile,
  ModuleDeclaration,
  ModuleDeclarationKind,
  type OptionalKind,
  type ModuleDeclarationStructure,
} from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { type ModuleConfig, type FileDefinition } from '../../types.js';
import { type ValidationResult } from '../contracts.js';
import { Reconciler } from '../../reconciler.js';

export class ModulePrimitive extends BasePrimitive<ModuleDeclaration, ModuleConfig> {
  find(parent: SourceFile | ModuleDeclaration) {
    return parent.getModule(this.config.name);
  }

  create(parent: SourceFile | ModuleDeclaration): ModuleDeclaration {
    return parent.addModule(this.toStructure());
  }

  update(node: ModuleDeclaration) {
    if (this.config.isExported !== undefined && node.isExported() !== this.config.isExported) {
      node.setIsExported(this.config.isExported);
    }

    // Recursively reconcile contents
    Reconciler.reconcile(node, this.config as unknown as FileDefinition);
  }

  ensure(parent: SourceFile | ModuleDeclaration): ModuleDeclaration {
    let node = this.find(parent);
    if (!node) {
      node = this.create(parent);
    }
    this.update(node);
    return node;
  }

  validate(node: ModuleDeclaration): ValidationResult {
    const result = Reconciler.validate(node, this.config as unknown as FileDefinition);
    if (!result.valid) return result;

    const issues: string[] = [];
    if (this.config.isExported !== undefined && node.isExported() !== this.config.isExported) {
      issues.push(
        `Module '${this.config.name}' exported status mismatch. Expected: ${this.config.isExported}, Found: ${node.isExported()}`,
      );
    }

    return { valid: issues.length === 0, issues };
  }

  private toStructure(): OptionalKind<ModuleDeclarationStructure> {
    let kind = ModuleDeclarationKind.Namespace;
    let hasDeclareKeyword = false;

    if (this.config.name === 'global') {
      kind = ModuleDeclarationKind.Global;
      hasDeclareKeyword = true;
    } else if (this.config.isDeclaration) {
      if (this.config.name.includes('"') || this.config.name.includes("'")) {
        kind = ModuleDeclarationKind.Module;
        hasDeclareKeyword = true;
      }
    }

    return {
      name: this.config.name,
      isExported: this.config.isExported,
      declarationKind: kind,
      hasDeclareKeyword: hasDeclareKeyword,
      statements: [],
    };
  }
}
