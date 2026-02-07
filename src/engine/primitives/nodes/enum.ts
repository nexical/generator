import { SourceFile, EnumDeclaration, ModuleDeclaration } from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { type EnumConfig } from '../../types.js';
import { type ValidationResult } from '../contracts.js';

export class EnumPrimitive extends BasePrimitive<EnumDeclaration, EnumConfig> {
  find(parent: SourceFile | ModuleDeclaration) {
    return parent.getEnum(this.config.name);
  }

  create(parent: SourceFile | ModuleDeclaration): EnumDeclaration {
    return parent.addEnum({
      name: this.config.name,
      isExported: this.config.isExported,
      members: this.config.members.map((m) => ({
        name: m.name,
        value: m.value,
      })),
    });
  }

  update(node: EnumDeclaration) {
    const configMemberNames = this.config.members.map((m) => m.name);

    // 1. Remove members not in config
    node.getMembers().forEach((member) => {
      if (!configMemberNames.includes(member.getName())) {
        member.remove();
      }
    });

    // 2. Add or update members
    this.config.members.forEach((memberConfig) => {
      const member = node.getMember(memberConfig.name);
      if (member) {
        // Update value if different
        if (member.getValue() !== memberConfig.value) {
          member.setValue(memberConfig.value);
        }
      } else {
        // Add new member
        node.addMember({
          name: memberConfig.name,
          value: memberConfig.value,
        });
      }
    });
  }

  validate(node: EnumDeclaration): ValidationResult {
    const issues: string[] = [];

    this.config.members.forEach((m) => {
      const member = node.getMember(m.name);
      if (!member) {
        issues.push(`Enum '${this.config.name}' missing member '${m.name}'`);
      } else {
        if (member.getValue() !== m.value) {
          issues.push(
            `Enum '${this.config.name}' member '${m.name}' value mismatch. Expected: ${m.value}, Found: ${member.getValue()}`,
          );
        }
      }
    });

    return { valid: issues.length === 0, issues };
  }
}
