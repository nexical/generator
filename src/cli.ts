import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic Command Loading
// Exported for testing/programmatic usage
export const program = new Command();
program.name('arc').description('ArcNexus Generator CLI').version('0.0.1');

async function registerCommands() {
  const commandsDir = path.join(__dirname, 'commands');

  // Recursive function to find command files
  async function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
        entry.name !== 'base.ts' &&
        !entry.name.endsWith('.d.ts')
      ) {
        try {
          // Use file:// protocol for absolute paths in ESM imports on Windows/Linux
          const module = await import(`file://${fullPath}`);

          if (module.default && typeof module.default === 'function') {
            const CommandClass = module.default;
            const usage = CommandClass.usage;
            const description = CommandClass.description || '';
            const argsDef = CommandClass.args || {};

            if (usage) {
              const cmd = program.command(usage).description(description);

              if (argsDef.args) {
                argsDef.args.forEach(
                  (arg: { name: string; description: string; required?: boolean }) => {
                    const argName = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
                    cmd.argument(argName, arg.description);
                  },
                );
              }

              if (argsDef.options) {
                argsDef.options.forEach(
                  (opt: {
                    name: string;
                    description: string;
                    default?: string | boolean | string[];
                  }) => {
                    cmd.option(opt.name, opt.description, opt.default);
                  },
                );
              }

              cmd.action(async (...args: unknown[]) => {
                const options = args.pop() as Record<string, unknown>;
                const positionalArgs = args;
                const finalOptions = { ...options };

                if (argsDef.args) {
                  argsDef.args.forEach((arg: { name: string }, index: number) => {
                    finalOptions[arg.name] = positionalArgs[index];
                  });
                }

                const commandInstance = new CommandClass(program, {});
                await commandInstance.run(finalOptions);
              });

              console.info(`[CLI] Registered command: ${usage}`);
            } else {
              console.warn(`[CLI] Skipping ${entry.name}: missing static usage`);
            }
          }
        } catch (error) {
          console.error(chalk.red(`Failed to load command from ${entry.name}:`), error);
        }
      }
    }
  }

  console.info(`[CLI] Scanning for commands in: ${commandsDir}`);
  await scanDir(commandsDir);
  console.info(`[CLI] Registration complete.`);
}

export async function main() {
  try {
    await registerCommands();
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red('CLI Error:'), error);
    process.exit(1);
  }
}
