import { Command } from 'commander';
import { CustomHelp } from './help.js';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';

export interface CommandArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface CommandOption {
  name: string;
  description: string;
}

export interface CommandDefinition {
  args?: CommandArgument[] | Record<string, string>;
  options?: CommandOption[] | Record<string, string>;
  helpMetadata?: {
    examples?: string[];
    troubleshooting?: string[];
  };
  name?: string;
  description?: string;
}

export abstract class BaseCommand {
  protected command: Command;

  constructor(config?: CommandDefinition) {
    const ctor = this.constructor as unknown as {
      args: CommandDefinition;
      usage: string;
      description: string;
    };
    const staticConfig = ctor.args;
    const usage = ctor.usage;
    const description = ctor.description;

    const name = config?.name || usage || '';
    const desc = config?.description || description || '';

    this.command = new Command(name);
    this.command.description(desc);

    // Debug logging
    // console.log('[BaseCommand] Initialized with name:', name);
    // console.log('[BaseCommand] info method present:', typeof this.info);

    this.configure(config || staticConfig);
  }

  private configure(config?: CommandDefinition) {
    if (!config) return;

    // Add arguments
    if (config.args) {
      if (Array.isArray(config.args)) {
        config.args.forEach((arg) => {
          const argStr = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
          this.command.argument(argStr, arg.description);
        });
      } else {
        Object.entries(config.args).forEach(([name, desc]) => {
          this.command.argument(name, desc);
        });
      }
    }

    // Add options
    if (config.options) {
      if (Array.isArray(config.options)) {
        config.options.forEach((opt) => {
          this.command.option(opt.name, opt.description);
        });
      } else {
        Object.entries(config.options).forEach(([flags, desc]) => {
          this.command.option(flags, desc);
        });
      }
    }

    // Custom Help
    this.command.configureHelp({
      formatHelp: (cmd) => {
        const sections = [];
        const helpMetadata = config.helpMetadata;
        if (helpMetadata?.examples) {
          sections.push({
            header: 'Examples',
            content: helpMetadata.examples.join('\n'),
          });
        }
        if (helpMetadata?.troubleshooting) {
          sections.push({
            header: 'Troubleshooting',
            content: helpMetadata.troubleshooting.join('\n'),
          });
        }
        return CustomHelp.format(cmd, sections);
      },
    });

    // Action Handler
    this.command.action(async (...args: unknown[]) => {
      try {
        await this.run(...args);
      } catch (error) {
        console.error(chalk.red('Command failed:'));
        if (error instanceof Error) {
          console.error(chalk.red(error.message));
          if (process.env.DEBUG === 'true') {
            console.error(chalk.dim(error.stack));
          }
        } else {
          console.error(chalk.red(String(error)));
        }
        process.exit(1);
      }
    });
  }

  abstract run(...args: unknown[]): Promise<void>;

  info(msg: string) {
    logger.info(msg);
  }

  warn(msg: string) {
    logger.warn(msg);
  }

  error(msg: string) {
    logger.error(msg);
  }

  success(msg: string) {
    logger.success(msg);
  }

  getCommand(): Command {
    return this.command;
  }
}
