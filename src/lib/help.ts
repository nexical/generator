import chalk from 'chalk';
import { Command } from 'commander';

export interface HelpSection {
  header: string;
  content: string;
}

export class CustomHelp {
  static format(command: Command, sections: HelpSection[] = []) {
    let output = '';

    // Usage
    output += chalk.bold.underline('Usage:') + '\n';
    output += `  $ ${command.name()} ${command.usage()}\n\n`;

    // Description
    if (command.description()) {
      output += chalk.bold.underline('Description:') + '\n';
      output += `  ${command.description()}\n\n`;
    }

    // Arguments
    if (command.registeredArguments.length > 0) {
      output += chalk.bold.underline('Arguments:') + '\n';
      command.registeredArguments.forEach((arg) => {
        output += `  ${chalk.green(arg.name())}\t${arg.description}\n`;
      });
      output += '\n';
    }

    // Options
    if (command.options.length > 0) {
      output += chalk.bold.underline('Options:') + '\n';
      command.options.forEach((option: { flags: string; description: string }) => {
        output += `  ${chalk.yellow(option.flags)}\t${option.description}\n`;
      });
      output += '\n';
    }

    // Custom Sections (Examples, Troubleshooting, etc.)
    sections.forEach((section) => {
      output += chalk.bold.underline(`${section.header}:`) + '\n';
      output +=
        section.content
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n') + '\n\n';
    });

    return output;
  }
}
