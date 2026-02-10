#!/usr/bin/env -S npx tsx
/* eslint-disable */

import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import { spawn, execSync } from 'node:child_process';
import minimist from 'minimist';
import readline from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// For the generator project, prompts is in the root of the package.
// dist/utils/prompt.js -> ../../prompts
// src/utils/prompt.ts -> ../../prompts
const PROMPTS_DIR = path.join(__dirname, '../../prompts');

// Helper to run Gemini with a specific model
interface GeminiResult {
  code: number;
  shouldRetry: boolean;
  output: string;
}

function runGemini(model: string, input: string): Promise<GeminiResult> {
  return new Promise((resolve) => {
    console.log(`[Agent] Attempting with model: \x1b[36m${model}\x1b[0m...`);

    const start = Date.now();
    const child = spawn(`gemini --yolo --model ${model}`, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout?.on('data', (data) => {
      const chunk = data.toString();
      process.stdout.write(chunk);
      stdoutData += chunk;
    });

    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      process.stderr.write(chunk);
      stderrData += chunk;
    });

    child.stdin.write(input);
    child.stdin.end();

    child.on('close', (code) => {
      const duration = Date.now() - start;
      const exitCode = code ?? 1;

      const isExhausted =
        stderrData.includes('429') ||
        stderrData.includes('exhausted your capacity') ||
        stderrData.includes('ResourceExhausted');

      if (exitCode !== 0 && isExhausted) {
        console.warn(
          `[Agent] \u26A0\ufe0f Model ${model} exhausted (429). Duration: ${duration}ms`,
        );
        resolve({ code: exitCode, shouldRetry: true, output: stdoutData });
      } else {
        resolve({ code: exitCode, shouldRetry: false, output: stdoutData });
      }
    });

    child.on('error', (err) => {
      console.error(`[Agent] Failed to spawn Gemini (${model}):`, err);
      resolve({ code: 1, shouldRetry: false, output: '' });
    });
  });
}

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

  env.addGlobal('context', (targetPath: string) => {
    try {
      console.log(`[Context] Analyzing codebase at: ${targetPath}`);
      const output = execSync(
        `npx -y repomix --stdout --quiet --style xml --include "${targetPath}/**/*" --ignore "**/node_modules,**/dist"`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] },
      );
      return `<CODEBASE_CONTEXT path="${targetPath}">\n${output}\n</CODEBASE_CONTEXT>`;
    } catch (error) {
      console.error(`[Context] Error running repomix on ${targetPath}`);
      return `[Error generating context for ${targetPath}]`;
    }
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

  let templateContent: string;
  try {
    templateContent = await fs.readFile(promptFile, 'utf-8');
  } catch (error) {
    console.error(`Error reading prompt file: ${error}`);
    process.exit(1);
  }

  console.log(`[Render] Rendering template with variables:`, JSON.stringify(argv, null, 2));
  const renderedPrompt = env.renderString(templateContent, {
    ...argv,
  });

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

    for (const model of models) {
      const result = await runGemini(model, currentPrompt);

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
      });
      return new Promise<string>((resolve) => {
        console.log('\n(Type "exit" or "quit" to end the session)');
        rl.question('> ', (ans) => {
          rl.close();
          resolve(ans);
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
