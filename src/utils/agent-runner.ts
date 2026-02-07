import { execSync } from 'node:child_process';
import { logger } from '@nexical/cli-core';

const PROMPT_CMD = 'npx prompt';
// Use the same models as reskill for consistency
const MODELS = 'gemini-3-flash-preview,gemini-3-pro-preview';

export class AgentRunner {
  static run(
    agentName: string,
    promptPath: string,
    args: Record<string, string>,
    interactive: boolean = false,
  ) {
    const allArgs = { ...args, models: MODELS };
    const flags = Object.entries(allArgs)
      .map(([key, value]) => `--${key} "${value}"`)
      .join(' ');

    // promptPath should be absolute or relative to CWD.
    // If we assume prompts/ is in root, we might need to adjust.
    // But since context is usually CWD (root), prompts/agents/X is fine.

    // If interactive, we might want to ensure the prompt tool knows it.
    // Assuming the tool is interactive by default if not outputting to file?
    // Or maybe we just depend on stdio inherit.

    let cmd = `${PROMPT_CMD} ${promptPath} ${flags}`;
    if (interactive) {
      cmd += ' --interactive';
    }

    logger.info(`\n🤖 Agent ${agentName} working...`);
    try {
      execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Agent ${agentName} failed execution: ${message}`);
    }
  }
}
