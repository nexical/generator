import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPT_SCRIPT = path.resolve(__dirname, '../../../src/utils/prompt.ts');

describe('prompt utility entry point', () => {
  it('should run as a script and show help', () => {
    // We use tsx to run the .ts file directly
    try {
      const output = execSync(`npx tsx ${PROMPT_SCRIPT} --help`, {
        encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'development' },
      });
      expect(output).toContain('Usage: npx prompt <prompt-name> [options]');
    } catch (e: unknown) {
      // If it fails because of npx/tsx issues in the test env, we might need another way
      // but this is the most direct way to cover those lines.
      const err = e as { stderr?: string; message?: string };
      console.error('Subprocess test failed', err.stderr || err.message);
      throw e;
    }
  });

  it('should handle errors in entry point', () => {
    // Triggering an error that runPrompt catches is hard from outside,
    // but we can at least try to run it with missing args which returns 0 but still hits the entry point flow.
    const output = execSync(`npx tsx ${PROMPT_SCRIPT}`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'development' },
    });
    expect(output).toContain('Usage:');
  });
});
