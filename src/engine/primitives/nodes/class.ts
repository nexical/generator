import {
  SourceFile,
  type ClassDeclarationStructure,
  type OptionalKind,
  ClassDeclaration,
  ModuleDeclaration,
} from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { type ValidationResult } from '../contracts.js';
import { type ClassConfig } from '../../types.js';
import { DecoratorPrimitive } from './decorator.js';
import { JSDocPrimitive } from './docs.js';

export class ClassPrimitive extends BasePrimitive<ClassDeclaration, ClassConfig> {
  find(parent: SourceFile | ModuleDeclaration) {
    return parent.getClass(this.config.name);
  }

  create(parent: SourceFile | ModuleDeclaration) {
    return parent.addClass(this.toStructure());
  }

  update(node: ClassDeclaration) {
    const structure = this.toStructure();

    if (structure.isExported !== node.isExported()) {
      node.setIsExported(structure.isExported!);
    }

    // Enforce Extends
    if (structure.extends && node.getExtends()?.getText() !== structure.extends) {
      node.setExtends(structure.extends as string);
    }

    if (this.config.isAbstract !== undefined && node.isAbstract() !== this.config.isAbstract) {
      node.setIsAbstract(this.config.isAbstract);
    }

    // Handle Implements
    if (this.config.implements) {
      const currentImplements = node.getImplements().map((i) => i.getText());
      const newImplements = this.config.implements;

      // Simple additive/check logic.
      // If strict sync needed: remove existing not in config?
      // For now, let's ensure configured ones exist.
      for (const impl of newImplements) {
        if (!currentImplements.includes(impl)) {
          node.addImplements(impl);
        }
      }
    }

    // Handle Decorators
    this.config.decorators?.forEach((deco) => {
      new DecoratorPrimitive(deco).ensure(node);
    });

    // Handle JSDocs
    if (this.config.docs) {
      const description = this.config.docs.join('\n');
      new JSDocPrimitive({ description }).ensure(node);
    }
  }

  validate(node: ClassDeclaration): ValidationResult {
    const issues: string[] = [];
    const structure = this.toStructure();

    if (structure.isExported !== undefined && node.isExported() !== structure.isExported) {
      issues.push(
        `Class '${this.config.name}' exported status mismatch. Expected: ${structure.isExported}, Found: ${node.isExported()}`,
      );
    }

    if (structure.extends && node.getExtends()?.getText() !== structure.extends) {
      issues.push(
        `Class '${this.config.name}' extends mismatch. Expected: ${structure.extends}, Found: ${node.getExtends()?.getText()}`,
      );
    }

    if (this.config.isAbstract !== undefined && node.isAbstract() !== this.config.isAbstract) {
      issues.push(
        `Class '${this.config.name}' abstract mismatch. Expected: ${this.config.isAbstract}, Found: ${node.isAbstract()}`,
      );
    }

    if (this.config.implements) {
      const currentImplements = node.getImplements().map((i) => i.getText());
      const missing = this.config.implements.filter((i) => !currentImplements.includes(i));
      if (missing.length > 0) {
        issues.push(
          `Class '${this.config.name}' implements mismatch. Missing: ${missing.join(', ')}`,
        );
      }
    }

    // Validate Decorators
    this.config.decorators?.forEach((deco) => {
      const primitive = new DecoratorPrimitive(deco);
      const decoNode = primitive.find(node);
      if (!decoNode) {
        issues.push(`Decorator '@${deco.name}' is missing on class '${this.config.name}'.`);
      } else {
        const result = primitive.validate(decoNode);
        if (!result.valid) issues.push(...result.issues);
      }
    });

    // Validate JSDocs
    if (this.config.docs) {
      const description = this.config.docs.join('\n');
      const primitive = new JSDocPrimitive({ description });
      // JSDocPrimitive.find returns undefined if no docs
      const docNode = primitive.find(node);
      if (!docNode) {
        issues.push(`JSDoc is missing on class '${this.config.name}'.`);
      } else {
        const result = primitive.validate(docNode);
        if (!result.valid) issues.push(...result.issues);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  private toStructure(): OptionalKind<ClassDeclarationStructure> {
    return {
      name: this.config.name,
      isExported: this.config.isExported,
      extends: this.config.extends,
      implements: this.config.implements,
      decorators: this.config.decorators?.map((d) => ({ name: d.name, arguments: d.arguments })),
      docs: this.config.docs ? [{ description: this.config.docs.join('\n') }] : undefined,
    };
  }
}
