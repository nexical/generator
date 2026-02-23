#!/usr/bin/env -S npx tsx
/* eslint-disable */

import fs from 'node:fs/promises';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import minimist from 'minimist';
import readline from 'node:readline';
import { globSync } from 'glob';
import { pack } from 'repomix';
import { AiClientFactory } from '@nexical/ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// For the generator project, prompts is in the root of the package.
// dist/utils/prompt.js -> ../../prompts
// src/utils/prompt.ts -> ../../prompts
const PROMPTS_DIR = path.join(__dirname, '../../prompts');

async function main() {
  const argv = minimist(process.argv.slice(2));
  const promptName = argv._[0];

  if (!promptName || argv.help || argv.h) {
    console.log(`
Usage: npx prompt <prompt-name> [options]

Arguments:
  prompt-name   The name of the markdown file in the 'prompts' directory.

Options:
  --help, -h    Show this help message.
  ...flags      Any other flags are passed as variables to the template.

Examples:
  npx prompt auditor --target=src/foo.ts
`);
    process.exit(0);
  }

  const promptFile = path.join(
    PROMPTS_DIR,
    promptName.endsWith('.md') ? promptName : `${promptName}.md`,
  );

  try {
    await fs.access(promptFile);
  } catch (error) {
    console.error(`Error: Prompt file not found: ${promptFile}`);
    process.exit(1);
  }

  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(PROMPTS_DIR), {
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true,
  });

  const asyncResolvers = new Map<string, Promise<string>>();
  let resolverId = 0;

  env.addGlobal('context', (targetPath: string) => {
    const id = `__NEXICAL_ASYNC_CONTEXT_${resolverId++}__`;
    const promise = (async () => {
      try {
        if (!existsSync(targetPath)) {
          return `[Path not found: ${targetPath}]`;
        }

        const stats = statSync(targetPath);
        if (stats.isFile()) {
          const content = await fs.readFile(targetPath, 'utf-8');
          return `<CODEBASE_CONTEXT path="${targetPath}">\n${content}\n</CODEBASE_CONTEXT>`;
        }

        console.log(`[Context] Analyzing codebase at: ${targetPath}`);
        const tempOutputFile = path.join(
          os.tmpdir(),
          `repomix-output-${Date.now()}-${Math.random().toString(36).substring(7)}.xml`,
        );

        await pack([targetPath], {
          input: { maxFileSize: 1024 * 1024 * 10 },
          output: {
            filePath: tempOutputFile,
            style: 'xml',
            showLineNumbers: false,
            fileSummary: false,
            directoryStructure: false,
            removeComments: false,
            removeEmptyLines: false,
            includeEmptyDirectories: false,
            topFilesLength: 5,
            parsableStyle: false,
            files: true,
            compress: false,
            truncateBase64: true,
            copyToClipboard: false,
            includeDiffs: false,
            includeLogs: false,
            includeLogsCount: 0,
            gitSortByChanges: false,
            includeFullDirectoryStructure: false,
          },
          ignore: {
            useGitignore: true,
            useDotIgnore: true,
            useDefaultPatterns: true,
            customPatterns: ['**/node_modules', '**/dist'],
          },
          include: [],
          security: { enableSecurityCheck: false },
          tokenCount: { encoding: 'o200k_base' },
          cwd: targetPath,
        } as any);

        const output = await fs.readFile(tempOutputFile, 'utf-8');
        try {
          await fs.unlink(tempOutputFile);
        } catch {}
        return `<CODEBASE_CONTEXT path="${targetPath}">\n${output}\n</CODEBASE_CONTEXT>`;
      } catch (error) {
        console.error(`[Context] Error generating context for ${targetPath}: ${error}`);
        return `[Error generating context for ${targetPath}]`;
      }
    })();
    asyncResolvers.set(id, promise);
    return id;
  });

  env.addGlobal('read', (relativePath: string) => {
    try {
      const resolvedPath = path.resolve(process.cwd(), relativePath);
      const content = readFileSync(resolvedPath, 'utf-8');
      return content;
    } catch (error) {
      console.error(`[Read] Error reading file: ${relativePath}`);
      return `[Error reading file ${relativePath}]`;
    }
  });

  env.addGlobal('read_glob', (pattern: string) => {
    try {
      const files = globSync(pattern, { cwd: process.cwd(), absolute: true });
      if (files.length === 0) return `[No files found for pattern: ${pattern}]`;

      return files
        .map((file) => {
          try {
            const content = readFileSync(file, 'utf-8');
            const relPath = path.relative(process.cwd(), file);
            return `<file name="${relPath}">\n${content}\n</file>`;
          } catch (err) {
            return `[Error reading file ${file}]`;
          }
        })
        .join('\n');
    } catch (error) {
      console.error(`[ReadGlob] Error with pattern: ${pattern}`, error);
      return `[Error processing glob: ${pattern}]`;
    }
  });

  env.addGlobal('read_specs', (pattern: string) => {
    return env.getGlobal('read_glob')(pattern);
  });

  env.addGlobal('compressed_map', (targetPath: string) => {
    const id = `__NEXICAL_ASYNC_COMPRESSED_MAP_${resolverId++}__`;
    const promise = (async () => {
      try {
        console.log(`[Context] Generating compressed map for: ${targetPath}`);
        const tempOutputFile = path.join(
          os.tmpdir(),
          `repomix-output-${Date.now()}-${Math.random().toString(36).substring(7)}.xml`,
        );

        await pack([targetPath], {
          input: { maxFileSize: 1024 * 1024 * 50 },
          output: {
            filePath: tempOutputFile,
            style: 'xml',
            showLineNumbers: false,
            fileSummary: false,
            directoryStructure: false,
            removeComments: false,
            removeEmptyLines: false,
            includeEmptyDirectories: false,
            topFilesLength: 5,
            parsableStyle: false,
            files: true,
            compress: false,
            truncateBase64: true,
            copyToClipboard: false,
            includeDiffs: false,
            includeLogs: false,
            includeLogsCount: 0,
            gitSortByChanges: false,
            includeFullDirectoryStructure: false,
          },
          ignore: {
            useGitignore: true,
            useDotIgnore: true,
            useDefaultPatterns: true,
            customPatterns: [
              '**/node_modules',
              '**/dist',
              '**/*.spec.ts',
              '**/*.test.ts',
              '**/coverage',
              '**/.git',
            ],
          },
          include: [],
          security: { enableSecurityCheck: false },
          tokenCount: { encoding: 'o200k_base' },
          cwd: targetPath,
        } as any);

        const output = await fs.readFile(tempOutputFile, 'utf-8');
        try {
          await fs.unlink(tempOutputFile);
        } catch {}
        return `<COMPRESSED_MAP path="${targetPath}">\n${output}\n</COMPRESSED_MAP>`;
      } catch (error) {
        console.error(`[Context] Error generating map for ${targetPath}: ${error}`);
        return `[Error generating map for ${targetPath}]`;
      }
    })();
    asyncResolvers.set(id, promise);
    return id;
  });

  let templateContent: string;
  try {
    templateContent = await fs.readFile(promptFile, 'utf-8');
  } catch (error) {
    console.error(`Error reading prompt file: ${error}`);
    process.exit(1);
  }

  console.log(`[Render] Rendering template with variables:`, JSON.stringify(argv, null, 2));
  let renderedPrompt: string;
  try {
    renderedPrompt = env.renderString(templateContent, {
      ...argv,
    });
  } catch (e) {
    console.error(`Template render error: ${e}`);
    process.exit(1);
  }

  for (const [id, promise] of asyncResolvers.entries()) {
    try {
      const resolvedValue = await promise;
      renderedPrompt = renderedPrompt.replace(id, resolvedValue);
    } catch (e) {
      console.error(`[Render] Failed to resolve async variable ${id}: ${e}`);
      renderedPrompt = renderedPrompt.replace(id, `[Error resolving ${id}]`);
    }
  }

  const tempFile = path.join(os.tmpdir(), '.temp_prompt_active.md');
  await fs.writeFile(tempFile, renderedPrompt, 'utf-8');
  console.log(`[Buffer] Wrote active prompt to ${tempFile}`);

  const defaultModel = 'gemini-3-flash-preview,gemini-3-pro-preview';
  const modelsArg = argv.models || defaultModel;
  const models = modelsArg
    .split(',')
    .map((m: string) => m.trim())
    .filter(Boolean);

  console.log(`[Agent] Model rotation strategy: [${models.join(', ')}]`);

  let currentPrompt = renderedPrompt;
  let finalCode = 0;

  while (true) {
    let success = false;
    let lastOutput = '';

    let aiConfig = undefined;
    if (argv.aiConfig) {
      try {
        aiConfig = JSON.parse(argv.aiConfig);
      } catch (e) {
        console.warn('[Agent] Failed to parse aiConfig', e);
      }
    }

    const aiClient = AiClientFactory.create(aiConfig);
    for (const model of models) {
      console.log(`[Agent] Attempting with model: \x1b[36m${model}\x1b[0m...`);
      const result = await aiClient.run(model, currentPrompt);

      if (result.code === 0) {
        success = true;
        lastOutput = result.output;
        break;
      }

      if (result.shouldRetry) {
        console.log(`[Agent] Switching to next model...`);
        continue;
      } else {
        finalCode = result.code;
        break;
      }
    }

    if (!success) {
      if (finalCode === 0) finalCode = 1;
      console.error(`[Agent] \u274C All attempts failed.`);
      break;
    }

    if (!argv.interactive) {
      break;
    }

    currentPrompt += `\n${lastOutput}`;

    const askLink = () => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });

      return new Promise<string>((resolve) => {
        console.log(
          '\n(Type "exit" or "quit" to end. To submit, press Enter. For multi-line, end line with \\ or paste text)',
        );
        process.stdout.write('> ');

        let lines: string[] = [];
        let submitTimer: NodeJS.Timeout | null = null;
        const PASTE_DELAY = 10; // ms to wait for next line (pasting is usually < 5ms)

        rl.on('line', (line) => {
          // If we are receiving lines rapidly, clear the timer
          if (submitTimer) {
            clearTimeout(submitTimer);
            submitTimer = null;
          }

          const trimmed = line.trim();

          // Handle exit check only on the very first line if it's the only content
          if (lines.length === 0 && ['exit', 'quit'].includes(trimmed.toLowerCase())) {
            rl.close();
            resolve(trimmed);
            return;
          }

          // Check for manual continuation with backslash
          if (line.endsWith('\\')) {
            lines.push(line.slice(0, -1)); // Remove the backslash
            // Prompt for next line visual cue
            process.stdout.write('... ');
            return;
          }

          lines.push(line);

          // Set a timer to submit.
          // If the user is pasting, the next 'line' event will fire before this timer triggers,
          // clearing this timer and appending the next line.
          // If the user just hit Enter manually, this timer will fire and submit.
          submitTimer = setTimeout(() => {
            rl.close();
            resolve(lines.join('\n'));
          }, PASTE_DELAY);
        });
      });
    };

    const answer = await askLink();

    if (['exit', 'quit'].includes(answer.trim().toLowerCase())) {
      break;
    }

    currentPrompt += `\nUser: ${answer}\n`;
  }

  try {
    await fs.unlink(tempFile);
    console.log(`[Cleanup] Removed active prompt file`);
  } catch {}

  process.exit(finalCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
