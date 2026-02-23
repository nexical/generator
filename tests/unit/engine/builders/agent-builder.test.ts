/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { AgentBuilder } from '../../../../src/engine/builders/agent-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('AgentBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should generate agent files from config', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('agents.yaml')) {
        return `
agents:
  - name: "ScrapeProcessor"
    type: "job"
    payload:
      url: string
  - name: "MonitorAgent"
    type: "persistent"
    interval: 5000
`;
      }
      return '';
    });

    const builder = new AgentBuilder('test-api', { name: 'test-api' });
    await builder.build(project, undefined);

    const scrapeFile = project.getSourceFile((f) => f.getFilePath().endsWith('ScrapeProcessor.ts'));
    expect(scrapeFile).toBeDefined();
    const scrapeText = scrapeFile?.getFullText();
    expect(scrapeText).toContain('export class ScrapeProcessor extends JobProcessor<unknown>');
    expect(scrapeText).toContain("static jobType: string = 'ScrapeProcessor'");
    expect(scrapeText).toContain('constructor(config: ProcessorConfig)');
    expect(scrapeText).toContain('super(config);');

    const monitorFile = project.getSourceFile((f) => f.getFilePath().endsWith('MonitorAgent.ts'));
    expect(monitorFile).toBeDefined();
    const monitorText = monitorFile?.getFullText();
    expect(monitorText).toContain('export class MonitorAgent extends PersistentAgent');
    expect(monitorText).toContain('interval: number = 5000');
  });

  it('should handle missing agents.yaml gracefully', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const builder = new AgentBuilder('test-api', { name: 'test-api' });
    await builder.build(project, undefined);

    // Will not construct files
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should catch readFileSync parsing errors gracefully', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('Unreadable');
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const builder = new AgentBuilder('test-api', { name: 'test-api' });
    await builder.build(project, undefined);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse agents.yaml'));
    warnSpy.mockRestore();
  });

  it('should handle missing payloads and intervals cleanly, and create directories', async () => {
    // Return true for agents.yaml existing, but false for directory existence to hit mkdirSync
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      if (String(path).endsWith('agents.yaml')) return true;
      return false;
    });
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('agents.yaml')) {
        return `
agents:
  - name: "EmptyJob"
    type: "job"
  - name: "EmptyAgent"
    type: "persistent"
`;
      }
      return '';
    });

    const builder = new AgentBuilder('test-api', { name: 'test-api' });
    await builder.build(project, undefined);

    const jobFile = project.getSourceFile((f) => f.getFilePath().endsWith('EmptyJob.ts'));
    expect(jobFile?.getText()).toContain('z.object(');

    const agentFile = project.getSourceFile((f) => f.getFilePath().endsWith('EmptyAgent.ts'));
    expect(agentFile?.getText()).toContain('interval: number = 60000');
  });
});
