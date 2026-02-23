#!/usr/bin/env -S npx tsx
/* eslint-disable */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import minimist from 'minimist';
import { PromptRunner } from '@nexical/ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_DIR = path.join(__dirname, '../../prompts');
const AGENT_PROMPTS_DIR = path.join(__dirname, '../../prompts/agents');

export async function runPrompt() {
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
    return 0;
  }

  let aiConfig = undefined;
  if (argv.aiConfig) {
    try {
      aiConfig = JSON.parse(argv.aiConfig);
    } catch (e) {
      console.warn('[Agent] Failed to parse aiConfig', e);
    }
  }

  const defaultModel = 'gemini-3-flash-preview,gemini-3-pro-preview';
  const modelsArg = argv.models || defaultModel;
  const models = modelsArg
    .split(',')
    .map((m: string) => m.trim())
    .filter(Boolean);

  const finalCode = await PromptRunner.run({
    promptName,
    promptDirs: [PROMPTS_DIR, AGENT_PROMPTS_DIR],
    args: argv,
    aiConfig,
    models,
    interactive: argv.interactive || false,
  });

  return finalCode;
}

if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  runPrompt()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
