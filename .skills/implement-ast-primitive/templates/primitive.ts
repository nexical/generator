import { Node } from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { ValidationResult } from '../contracts.js';
import { MyConfig } from '../../types.js';

/**
 * Replace MyNode with the specific ts-morph node type (e.g., ClassDeclaration).
 * Replace MyConfig with the configuration interface defined in types.ts.
 * Replace MyStructure with the corresponding ts-morph structure type (e.g., ClassDeclarationStructure).
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
   * Creates a new node using a structured definition.
   */
  create(parent: Node): MyNode {
    // Example: return parent.asKind(SyntaxKind.SourceFile)!.addClass(this.toStructure());
    throw new Error('Method not implemented. Use this.toStructure() to define the node.');
  }

  /**
   * Maps configuration to a ts-morph structure for clean creation.
   */
  private toStructure(): any {
    // Return the appropriate OptionalKind structure
    // Example: return { name: this.config.name, isExported: true };
    return {};
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
   * Aggregate issues from child primitives if applicable.
   */
  override validate(node: MyNode): ValidationResult {
    const issues: string[] = [];

    // 1. Local validation
    // Example: if (node.getName() !== this.config.name) issues.push(`Name drift: ${node.getName()} != ${this.config.name}`);

    // 2. Recursive validation (uncomment if composing primitives)
    /*
    if (this.config.children) {
      for (const childConfig of this.config.children) {
        const childNode = node.getChild(childConfig.name);
        if (childNode) {
          const result = new ChildPrimitive(childConfig).validate(childNode);
          issues.push(...result.issues.map(i => `Child ${childConfig.name}: ${i}`));
        } else {
          issues.push(`Missing child: ${childConfig.name}`);
        }
      }
    }
    */

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
