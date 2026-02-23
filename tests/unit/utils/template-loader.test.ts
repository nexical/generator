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
    expect(result.raw).toContain('const x = 100;');
  });

  it('should throw on invalid template format', () => {
    const invalidFile = join(testDir, 'invalid.tsf');
    writeFileSync(invalidFile, 'export const x = 1;');
    expect(() => TemplateLoader.load('test-unit/invalid.tsf')).toThrow('Invalid template format');
  });

  it('should load TSX template with explicit tag', () => {
    const tsxFile = join(testDir, 'comp.tsf');
    writeFileSync(tsxFile, 'export default fragment /* tsx */ `<div />`;');
    const result = TemplateLoader.load('test-unit/comp.tsf');
    expect(result.raw).toContain('<div />');
  });

  it('should load TSX template by extension .txf', () => {
    const txfFile = join(testDir, 'comp.txf');
    writeFileSync(txfFile, 'export default fragment `<span />`;');
    const result = TemplateLoader.load('test-unit/comp.txf');
    expect(result.raw).toContain('<span />');
  });
});
