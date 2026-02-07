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

    const scrapeFile = project.getSourceFile('src/agent/ScrapeProcessor.ts');
    expect(scrapeFile).toBeDefined();
    const scrapeText = scrapeFile?.getFullText();
    expect(scrapeText).toContain('export class ScrapeProcessor extends JobProcessor<unknown>');
    expect(scrapeText).toContain("static jobType: string = 'ScrapeProcessor'");
    expect(scrapeText).toContain('constructor(config: ProcessorConfig)');
    expect(scrapeText).toContain('super(config);');

    const monitorFile = project.getSourceFile('src/agent/MonitorAgent.ts');
    expect(monitorFile).toBeDefined();
    const monitorText = monitorFile?.getFullText();
    expect(monitorText).toContain('export class MonitorAgent extends PersistentAgent');
    expect(monitorText).toContain('interval: number = 5000');
  });
});
