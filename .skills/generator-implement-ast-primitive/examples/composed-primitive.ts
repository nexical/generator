import { ClassDeclaration, Node } from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { ValidationResult } from '../contracts.js';
import { DecoratorPrimitive } from './decorator-primitive.js';
import { ClassConfig } from '../../types.js';

/**
 * Example of a Composed Primitive: ClassPrimitive.
 * It manages its own class definition and delegates decorator logic to another primitive.
 */
export class ClassPrimitive extends BasePrimitive<ClassDeclaration, ClassConfig> {
  find(parent: Node): ClassDeclaration | undefined {
    // Assuming parent is a SourceFile or Module
    return parent.asKind(SyntaxKind.SourceFile)?.getClass(this.config.name);
  }

  create(parent: Node): ClassDeclaration {
    return parent.asKind(SyntaxKind.SourceFile)!.addClass({
      name: this.config.name,
      isExported: true,
    });
  }

  update(node: ClassDeclaration): void {
    // 1. Sync class properties
    node.setIsExported(this.config.isExported ?? true);

    // 2. Delegate to child primitives (Decorators)
    if (this.config.decorators) {
      for (const decoConfig of this.config.decorators) {
        new DecoratorPrimitive(decoConfig).ensure(node);
      }
    }
  }

  override validate(node: ClassDeclaration): ValidationResult {
    const issues: string[] = [];

    // Basic property check
    if (node.getName() !== this.config.name) {
      issues.push(`Class name drift: expected ${this.config.name}, found ${node.getName()}`);
    }

    // Delegate validation to children if needed
    if (this.config.decorators) {
      for (const decoConfig of this.config.decorators) {
        const decoNode = node.getDecorator(decoConfig.name);
        if (!decoNode) {
          issues.push(`Missing decorator: @${decoConfig.name}`);
        } else {
          const result = new DecoratorPrimitive(decoConfig).validate(decoNode);
          issues.push(...result.issues.map((i) => `Decorator @${decoConfig.name}: ${i}`));
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
