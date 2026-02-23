import { SourceFile, InterfaceDeclaration, ModuleDeclaration, CodeBlockWriter } from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { type InterfaceConfig } from '../../types.js';
import { type ValidationResult } from '../contracts.js';

export class InterfacePrimitive extends BasePrimitive<InterfaceDeclaration, InterfaceConfig> {
  find(parent: SourceFile | ModuleDeclaration) {
    return parent.getInterface(this.config.name);
  }

  create(parent: SourceFile | ModuleDeclaration): InterfaceDeclaration {
    return parent.addInterface({
      name: this.config.name,
      isExported: this.config.isExported,
      extends: this.config.extends,
      properties: this.config.properties?.map((p) => ({
        name: p.name,
        type: p.type,
        hasQuestionToken: p.optional,
        isReadonly: p.readonly,
      })),
      leadingTrivia: this.config.comments
        ? (writer: CodeBlockWriter) => {
            this.config.comments?.forEach((c) => writer.writeLine(c));
          }
        : undefined,
    });
  }

  update(node: InterfaceDeclaration) {
    // Properties
    if (this.config.properties) {
      this.config.properties.forEach((propConfig) => {
        const prop = node.getProperty(propConfig.name);

        if (prop) {
          // Update
          if (propConfig.type && prop.getType().getText() !== propConfig.type) {
            prop.setType(propConfig.type);
          }
          if (
            propConfig.optional !== undefined &&
            prop.hasQuestionToken() !== propConfig.optional
          ) {
            prop.setHasQuestionToken(propConfig.optional);
          }
        } else {
          // Create
          node.addProperty({
            name: propConfig.name,
            type: propConfig.type,
            hasQuestionToken: propConfig.optional,
            isReadonly: propConfig.readonly,
          });
        }
      });
    }

    // Extends
    if (this.config.extends) {
      // simplified extends handling - overwrite if different
      // A real implementation might want to merge or carefully diff
      const currentExtends = node.getExtends().map((e) => e.getText());
      const needsUpdate =
        this.config.extends.length !== currentExtends.length ||
        !this.config.extends.every((e) => currentExtends.includes(e));

      if (needsUpdate) {
        node.getExtends().forEach((e) => node.removeExtends(e)); // Clear old
        this.config.extends.forEach((e) => node.addExtends(e)); // Add new
      }
    }

    // Comments / Trivia
    // Always reconcile trivia for generated nodes to remove stale comments (like eslint-disable)
    // If config.comments is undefined, we clear it (or set to empty)
    if (this.config.comments) {
      const trivia = this.config.comments.map((c) => `// ${c}`).join('\n') + '\n';
      node.set({ leadingTrivia: trivia });
    }
  }

  validate(node: InterfaceDeclaration): ValidationResult {
    const issues: string[] = [];

    if (this.config.properties) {
      this.config.properties.forEach((p) => {
        const prop = node.getProperty(p.name);
        if (!prop) {
          issues.push(`Interface '${this.config.name}' missing property '${p.name}'`);
        } else {
          const curTypeRaw = prop.getType().getText();
          const curType = curTypeRaw.replace(/import\(.*?\)\./g, '').replace(/\s/g, '');
          const neuType = p.type.replace(/\s/g, '');

          if (curType !== neuType) {
            issues.push(
              `Interface '${this.config.name}' property '${p.name}' type mismatch. Expected: ${p.type}, Found: ${curTypeRaw}`,
            );
          }
        }
      });
    }

    return { valid: issues.length === 0, issues };
  }
}
