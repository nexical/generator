import {
  ClassDeclaration,
  GetAccessorDeclaration,
  SetAccessorDeclaration,
  type OptionalKind,
  type GetAccessorDeclarationStructure,
  type SetAccessorDeclarationStructure,
} from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { type AccessorConfig } from '../../types.js';
import { type ValidationResult } from '../contracts.js';
import { DecoratorPrimitive } from './decorator.js';
import { JSDocPrimitive } from './docs.js';
import { StatementFactory } from '../statements/factory.js';
import { Normalizer } from '../../../utils/normalizer.js';

type AccessorDeclaration = GetAccessorDeclaration | SetAccessorDeclaration;

export class AccessorPrimitive extends BasePrimitive<AccessorDeclaration, AccessorConfig> {
  find(parent: ClassDeclaration): AccessorDeclaration | undefined {
    if (this.config.kind === 'get') {
      return parent.getGetAccessor(this.config.name);
    } else {
      return parent.getSetAccessor(this.config.name);
    }
  }

  create(parent: ClassDeclaration): AccessorDeclaration {
    if (this.config.kind === 'get') {
      return parent.addGetAccessor(this.toGetStructure());
    } else {
      return parent.addSetAccessor(this.toSetStructure());
    }
  }

  update(node: AccessorDeclaration) {
    if (this.config.kind === 'get' && node instanceof GetAccessorDeclaration) {
      this.toGetStructure();
      if (
        this.config.returnType &&
        Normalizer.normalizeType(node.getReturnType().getText()) !==
          Normalizer.normalizeType(this.config.returnType)
      ) {
        node.setReturnType(this.config.returnType);
      }
      if (this.config.statements) {
        const newBody = StatementFactory.generateBlock(this.config.statements);
        if (Normalizer.normalize(node.getBodyText() || '') !== Normalizer.normalize(newBody)) {
          node.setBodyText(newBody);
        }
      }
    } else if (this.config.kind === 'set' && node instanceof SetAccessorDeclaration) {
      this.toSetStructure();
      if (this.config.parameters && this.config.parameters.length > 0) {
        // Updating parameters is complex, for now assume name/type update if count matches
        // Or just skip parameter update for MVP except maybe type
        const param = node.getParameters()[0];
        if (
          param &&
          this.config.parameters[0].type &&
          Normalizer.normalizeType(param.getTypeNode()?.getText() || '') !==
            Normalizer.normalizeType(this.config.parameters[0].type)
        ) {
          param.setType(this.config.parameters[0].type);
        }
      }
      if (this.config.statements) {
        const newBody = StatementFactory.generateBlock(this.config.statements);
        if (Normalizer.normalize(node.getBodyText() || '') !== Normalizer.normalize(newBody)) {
          node.setBodyText(newBody);
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

  validate(node: AccessorDeclaration): ValidationResult {
    const issues: string[] = [];
    // Basic validation
    if (this.config.kind === 'get' && !(node instanceof GetAccessorDeclaration)) {
      issues.push(`Accessor '${this.config.name}' kind mismatch. Expected get.`);
    }
    if (this.config.kind === 'set' && !(node instanceof SetAccessorDeclaration)) {
      issues.push(`Accessor '${this.config.name}' kind mismatch. Expected set.`);
    }

    if (
      this.config.kind === 'get' &&
      node instanceof GetAccessorDeclaration &&
      this.config.returnType
    ) {
      const curType = Normalizer.normalizeType(node.getReturnType().getText());
      const neuType = Normalizer.normalizeType(this.config.returnType);
      if (curType !== neuType) {
        issues.push(
          `Accessor '${this.config.name}' return type mismatch. Expected: ${this.config.returnType}, Found: ${node.getReturnType().getText()}`,
        );
      }
    }

    // Validate Decorators
    this.config.decorators?.forEach((deco) => {
      const primitive = new DecoratorPrimitive(deco);
      const decoNode = primitive.find(node);
      if (!decoNode) {
        issues.push(`Decorator '@${deco.name}' is missing on accessor '${this.config.name}'.`);
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
        issues.push(`JSDoc is missing on accessor '${this.config.name}'.`);
      } else {
        const result = primitive.validate(docNode);
        if (!result.valid) issues.push(...result.issues);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  private toGetStructure(): OptionalKind<GetAccessorDeclarationStructure> {
    return {
      name: this.config.name,
      scope: this.config.scope,
      returnType: this.config.returnType,
      statements: StatementFactory.generateBlock(this.config.statements),
      isStatic: this.config.isStatic,
      decorators: this.config.decorators?.map((d) => ({ name: d.name, arguments: d.arguments })),
      docs: this.config.docs ? [{ description: this.config.docs.join('\n') }] : undefined,
    };
  }

  private toSetStructure(): OptionalKind<SetAccessorDeclarationStructure> {
    return {
      name: this.config.name,
      scope: this.config.scope,
      parameters: this.config.parameters?.map((p) => ({
        name: p.name,
        type: p.type,
      })),
      statements: StatementFactory.generateBlock(this.config.statements),
      isStatic: this.config.isStatic,
      decorators: this.config.decorators?.map((d) => ({ name: d.name, arguments: d.arguments })),
      docs: this.config.docs ? [{ description: this.config.docs.join('\n') }] : undefined,
    };
  }
}
