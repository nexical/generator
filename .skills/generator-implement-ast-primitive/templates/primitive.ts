import { Node } from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { ValidationResult } from '../contracts.js';
import { MyConfig } from '../../types.js';

/**
 * Replace MyNode with the specific ts-morph node type (e.g., ClassDeclaration).
 * Replace MyConfig with the configuration interface defined in types.ts.
 */
export class MyPrimitive extends BasePrimitive<MyNode, MyConfig> {
  /**
   * Locates an existing node within the parent.
   */
  find(parent: Node): MyNode | undefined {
    // Example: return parent.asKind(SyntaxKind.ClassDeclaration).find(c => c.getName() === this.config.name);
    return undefined;
  }

  /**
   * Creates a new node within the parent if find() returns undefined.
   */
  create(parent: Node): MyNode {
    // Example: return parent.addClass({ name: this.config.name });
    throw new Error('Method not implemented.');
  }

  /**
   * Synchronizes the existing node with the configuration.
   * This is used for reconciliation.
   */
  update(node: MyNode): void {
    // Example: node.setIsExported(this.config.isExported ?? true);
  }

  /**
   * Compares the actual AST node against the configuration.
   * Returns a ValidationResult with any detected drift.
   */
  override validate(node: MyNode): ValidationResult {
    const issues: string[] = [];

    // Example: if (node.getName() !== this.config.name) issues.push(`Name drift: ${node.getName()} != ${this.config.name}`);

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
