/** @vitest-environment node */
/* eslint-disable */
import { describe, it, expect, vi } from 'vitest';
import { CustomHelp } from '@nexical/generator/lib/help';
import { Command } from 'commander';
import chalk from 'chalk';

describe('CustomHelp', () => {
  it('should format help with all sections', () => {
    const program = new Command();
    program
      .name('test-cmd')
      .usage('[options] <arg>')
      .description('Test description')
      .argument('<arg>', 'test argument')
      .option('-o, --opt', 'test option');

    const output = CustomHelp.format(program, [{ header: 'Example', content: 'test-cmd my-arg' }]);

    expect(output).toContain('Usage:');
    expect(output).toContain('$ test-cmd [options] <arg>');
    expect(output).toContain('Description:');
    expect(output).toContain('Test description');
    expect(output).toContain('Arguments:');
    expect(output).toContain('test argument');
    expect(output).toContain('Options:');
    expect(output).toContain('-o, --opt');
    expect(output).toContain('Example:');
    expect(output).toContain('test-cmd my-arg');
  });

  it('should format help with missing sections (empty branches)', () => {
    const program = new Command();
    program.name('minimal');
    // No description, no arguments, no options

    const output = CustomHelp.format(program);

    expect(output).toContain('Usage:');
    expect(output).not.toContain('Description:');
    expect(output).not.toContain('Arguments:');
    expect(output).not.toContain('Options:');
  });

  it('should handle multi-line content in custom sections', () => {
    const program = new Command();
    program.name('test');

    const output = CustomHelp.format(program, [{ header: 'Multi', content: 'line1\nline2' }]);

    expect(output).toContain('Multi:');
    expect(output).toContain('  line1');
    expect(output).toContain('  line2');
  });
});
