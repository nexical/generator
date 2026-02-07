import {
  ClassDeclaration,
  PropertyDeclaration,
  Scope,
  type OptionalKind,
  type PropertyDeclarationStructure,
} from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { type PropertyConfig } from '../../types.js';
import { type ValidationResult } from '../contracts.js';
import { DecoratorPrimitive } from './decorator.js';
import { JSDocPrimitive } from './docs.js';
import { Normalizer } from '../../../utils/normalizer.js';

export class PropertyPrimitive extends BasePrimitive<PropertyDeclaration, PropertyConfig> {
  find(parent: ClassDeclaration) {
    return parent.getProperty(this.config.name);
  }

  create(parent: ClassDeclaration): PropertyDeclaration {
    return parent.addProperty(this.toStructure());
  }

  update(node: PropertyDeclaration) {
    const structure = this.toStructure();

    if (structure.type && node.getType().getText() !== structure.type) {
      node.setType(structure.type as string);
    }

    if (structure.initializer && node.getInitializer()?.getText() !== structure.initializer) {
      node.setInitializer(structure.initializer as string);
    }

    if (structure.scope && node.getScope() !== structure.scope) {
      node.setScope(structure.scope as Scope);
    }

    if (structure.isReadonly !== undefined && node.isReadonly() !== structure.isReadonly) {
      node.setIsReadonly(structure.isReadonly);
    }

    if (structure.isStatic !== undefined && node.isStatic() !== structure.isStatic) {
      node.setIsStatic(structure.isStatic);
    }

    if (
      structure.hasQuestionToken !== undefined &&
      node.hasQuestionToken() !== structure.hasQuestionToken
    ) {
      node.setHasQuestionToken(structure.hasQuestionToken);
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

  validate(node: PropertyDeclaration): ValidationResult {
    const issues: string[] = [];
    const structure = this.toStructure();

    const curTypeRaw = node.getTypeNode()?.getText() || node.getType().getText();
    const curType = Normalizer.normalizeType(curTypeRaw);
    const neuType = Normalizer.normalizeType((structure.type as string) || 'any');

    if (curType !== neuType) {
      issues.push(
        `Property '${this.config.name}' type mismatch. Expected: ${structure.type}, Found: ${curTypeRaw}`,
      );
    }

    if (structure.initializer) {
      const curInit = node.getInitializer()?.getText();
      if (curInit !== structure.initializer) {
        issues.push(
          `Property '${this.config.name}' initializer mismatch. Expected: ${structure.initializer}, Found: ${curInit}`,
        );
      }
    }

    if (structure.isStatic !== undefined && node.isStatic() !== structure.isStatic) {
      issues.push(`Property '${this.config.name}' static modifier mismatch.`);
    }

    // Validate Decorators
    this.config.decorators?.forEach((deco) => {
      const primitive = new DecoratorPrimitive(deco);
      const decoNode = primitive.find(node);
      if (!decoNode) {
        issues.push(`Decorator '@${deco.name}' is missing on property '${this.config.name}'.`);
      } else {
        const result = primitive.validate(decoNode);
        if (!result.valid) issues.push(...result.issues);
      }
    });

    // Validate JSDocs
    if (this.config.docs) {
      const description = this.config.docs.join('\n');
      const primitive = new JSDocPrimitive({ description });
      const docNode = primitive.find(node);
      if (!docNode) {
        issues.push(`JSDoc is missing on property '${this.config.name}'.`);
      } else {
        const result = primitive.validate(docNode);
        if (!result.valid) issues.push(...result.issues);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  private toStructure(): OptionalKind<PropertyDeclarationStructure> {
    return {
      name: this.config.name,
      type: this.config.type,
      initializer:
        this.config.initializer &&
        typeof this.config.initializer === 'object' &&
        'raw' in this.config.initializer
          ? (this.config.initializer as { raw: string }).raw
          : (this.config.initializer as string),
      scope: this.config.scope,
      isStatic: this.config.isStatic,
      isReadonly: this.config.readonly,
      hasQuestionToken: this.config.optional,
      decorators: this.config.decorators?.map((d) => ({ name: d.name, arguments: d.arguments })),
      docs: this.config.docs ? [{ description: this.config.docs.join('\n') }] : undefined,
    };
  }
}
