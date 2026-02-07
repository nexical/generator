import { Node, Decorator, type OptionalKind, type DecoratorStructure } from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { type ValidationResult } from '../contracts.js';
import { type DecoratorConfig } from '../../types.js';

export class DecoratorPrimitive extends BasePrimitive<Decorator, DecoratorConfig> {
  find(parent: Node): Decorator | undefined {
    if (!Node.isDecoratable(parent)) return undefined;
    return (
      parent as unknown as { getDecorator(cb: (d: Decorator) => boolean): Decorator | undefined }
    ).getDecorator((d: Decorator) => d.getName() === this.config.name);
  }

  create(parent: Node): Decorator {
    return (
      parent as unknown as { addDecorator(structure: OptionalKind<DecoratorStructure>): Decorator }
    ).addDecorator(this.toStructure());
  }

  update(node: Decorator) {
    const structure = this.toStructure();

    const currentArgs = node.getArguments().map((a) => a.getText());
    const targetArgs = (structure.arguments as string[]) || [];

    const isArgsDrift =
      currentArgs.length !== targetArgs.length ||
      currentArgs.some((arg, i) => arg !== targetArgs[i]);

    if (isArgsDrift) {
      node.replaceWithText(this.generateText());
    }
  }

  validate(node: Decorator): ValidationResult {
    const issues: string[] = [];

    const currentArgs = node.getArguments().map((a) => a.getText());
    const targetArgs = this.config.arguments || [];

    if (currentArgs.length !== targetArgs.length) {
      issues.push(
        `Decorator '@${this.config.name}' argument count mismatch. Expected: ${targetArgs.length}, Found: ${currentArgs.length}`,
      );
    } else {
      currentArgs.forEach((arg, i) => {
        if (arg !== targetArgs[i]) {
          issues.push(
            `Decorator '@${this.config.name}' argument ${i} mismatch. Expected: ${targetArgs[i]}, Found: ${arg}`,
          );
        }
      });
    }

    return { valid: issues.length === 0, issues };
  }

  private toStructure(): OptionalKind<DecoratorStructure> {
    return {
      name: this.config.name,
      arguments: this.config.arguments,
    };
  }

  private generateText(): string {
    const args = this.config.arguments?.join(', ') || '';
    return `@${this.config.name}(${args})`;
  }
}
