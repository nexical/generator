/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TemplateLoader } from '../../../src/utils/template-loader.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('TemplateLoader', () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const templatesDir = resolve(__dirname, '../../../templates');
  const testDir = join(templatesDir, 'test-unit');
  const testFile = join(testDir, 'dummy.tsf');

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    writeFileSync(
      testFile,
      `
import { fragment } from '@nexical/generator';
export default fragment\`
  const x = \${myVar};
\`;
        `,
    );
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should load template and interpolate variables', () => {
    const result = TemplateLoader.load('test-unit/dummy.tsf', { myVar: '100' });
    // Clean up formatting/whitespace might be needed if raw includes new lines?
    // raw should be "  const x = 100;\n" roughly.
    expect(result.raw).toContain('const x = 100;');
  });
});
