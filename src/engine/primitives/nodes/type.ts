import { SourceFile, TypeAliasDeclaration, ModuleDeclaration } from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { type TypeConfig } from '../../types.js';
import { type ValidationResult } from '../contracts.js';
import { Normalizer } from '../../../utils/normalizer.js';

export class TypePrimitive extends BasePrimitive<TypeAliasDeclaration, TypeConfig> {
  find(parent: SourceFile | ModuleDeclaration) {
    return parent.getTypeAlias(this.config.name);
  }

  create(parent: SourceFile | ModuleDeclaration): TypeAliasDeclaration {
    return parent.addTypeAlias({
      name: this.config.name,
      isExported: this.config.isExported,
      type: this.config.type,
    });
  }

  update(node: TypeAliasDeclaration) {
    if (this.config.isExported !== undefined && node.isExported() !== this.config.isExported) {
      node.setIsExported(this.config.isExported);
    }
    const curTypeRaw = node.getTypeNode()?.getText() || '';
    if (Normalizer.normalizeType(curTypeRaw) !== Normalizer.normalizeType(this.config.type)) {
      node.setType(this.config.type);
    }
  }

  validate(node: TypeAliasDeclaration): ValidationResult {
    const issues: string[] = [];

    const curTypeRaw = node.getTypeNode()?.getText() || '';
    if (Normalizer.normalizeType(curTypeRaw) !== Normalizer.normalizeType(this.config.type)) {
      issues.push(
        `Type '${this.config.name}' definition mismatch. Expected: ${this.config.type}, Found: ${curTypeRaw}`,
      );
    }

    return { valid: issues.length === 0, issues };
  }
}
