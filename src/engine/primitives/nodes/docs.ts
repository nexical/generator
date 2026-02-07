import { Node, JSDoc, type OptionalKind, type JSDocStructure } from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { type ValidationResult } from '../contracts.js';

interface JSDocConfig {
  description: string;
}

export class JSDocPrimitive extends BasePrimitive<JSDoc, JSDocConfig> {
  find(parent: Node): JSDoc | undefined {
    if (!Node.isJSDocable(parent)) return undefined;
    const docs = (parent as unknown as { getJsDocs(): JSDoc[] }).getJsDocs?.();

    if (docs && docs.length > 0) {
      return docs[0];
    }
    return undefined;
  }

  create(parent: Node): JSDoc {
    return (
      parent as unknown as { addJsDoc(structure: OptionalKind<JSDocStructure>): JSDoc }
    ).addJsDoc(this.toStructure());
  }

  update(node: JSDoc) {
    const structure = this.toStructure();

    const currentDesc = node.getDescription().trim();
    const newDesc = ((structure.description as string) || '').trim();

    if (currentDesc !== newDesc) {
      node.setDescription(newDesc);
    }
  }

  validate(node: JSDoc): ValidationResult {
    const issues: string[] = [];
    const structure = this.toStructure();

    const currentDesc = node.getDescription().trim();
    const newDesc = ((structure.description as string) || '').trim();

    if (currentDesc !== newDesc) {
      issues.push(`JSDoc description mismatch. Expected: "${newDesc}", Found: "${currentDesc}"`);
    }

    return { valid: issues.length === 0, issues };
  }

  private toStructure(): OptionalKind<JSDocStructure> {
    return {
      description: this.config.description,
    };
  }
}
