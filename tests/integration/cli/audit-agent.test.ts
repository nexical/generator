import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { createMockCommand } from '../helpers/mock-command.js';

vi.mock('../../../src/lib/module-locator.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/lib/module-locator.js')>();
  return {
    ...original,
    ModuleLocator: {
      ...original.ModuleLocator,
      expand: vi.fn(),
    },
  };
});

import { ModuleLocator } from '../../../src/lib/module-locator.js';
import { auditAgentModule } from '../../../src/lib/audit-agent.js';

const VALID_AGENTS_YAML = `
agents:
  - name: CrawlerAgent
    type: tick
    interval: 60
    description: "Crawl web content"
`;

const INVALID_AGENTS_YAML = `
agents:
  - name: BadAgent
    badInterval: "none"
`;

describe('audit-agent Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexical-audit-agent-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should report no issues for a module with valid agents.yaml', async () => {
    await fs.writeFile(path.join(tmpDir, 'agents.yaml'), VALID_AGENTS_YAML);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'crawler-agent', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await auditAgentModule(command, 'crawler-agent', { schema: true });

    expect(command.success).toHaveBeenCalledWith(
      expect.stringContaining('Audit passed for all 1 modules.'),
    );
  });

  it('should report issue when agents.yaml is missing', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'no-agent', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await auditAgentModule(command, 'no-agent', { schema: false });

    const errorCalls = vi.mocked(command.error).mock.calls.flat().map(String);
    expect(errorCalls.some((m) => m.includes('Audit failed'))).toBe(true);
  });

  it('should report issue for invalid agents.yaml schema', async () => {
    await fs.writeFile(path.join(tmpDir, 'agents.yaml'), INVALID_AGENTS_YAML);

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'bad-agent', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await auditAgentModule(command, 'bad-agent', { schema: true });

    const infoCalls = vi.mocked(command.info).mock.calls.flat().map(String);
    expect(infoCalls.some((m) => m.includes('[bad-agent]'))).toBe(true);
  });
});
