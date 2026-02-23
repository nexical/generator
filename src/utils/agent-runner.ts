import { PromptRunner, type AiClientConfig } from '@nexical/ai';
import { logger } from '@nexical/cli-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure we look in the right place for templates depending on CWD or __dirname
const PROMPTS_DIR = path.join(__dirname, '../../prompts');
const AGENT_PROMPTS_DIR = path.join(__dirname, '../../prompts/agents');
const MODELS = ['gemini-3-flash-preview', 'gemini-3-pro-preview'];

export class AgentRunner {
  static async run(
    agentName: string,
    promptPath: string,
    args: Record<string, unknown>,
    interactive: boolean = false,
  ) {
    logger.info(`\n🤖 Agent ${agentName} working...`);

    // Extract aiConfig from args if present
    const aiConfig = args.aiConfig as AiClientConfig | undefined;

    try {
      const exitCode = await PromptRunner.run({
        promptName: promptPath,
        promptDirs: [PROMPTS_DIR, AGENT_PROMPTS_DIR, process.cwd()],
        args,
        aiConfig,
        models: MODELS,
        interactive,
      });

      if (exitCode !== 0) {
        throw new Error(`Execution failed with code ${exitCode}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Agent ${agentName} failed execution: ${message}`);
    }
  }
}
