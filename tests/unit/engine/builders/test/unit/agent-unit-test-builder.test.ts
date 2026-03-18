/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { AgentUnitTestBuilder } from '@nexical/generator/engine/builders/test/unit/agent-unit-test-builder.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';

vi.mock('@nexical/generator/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn((name, data) => `// Mock content for ${name}`),
  },
}));

describe('AgentUnitTestBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('agent.test.ts', '');
    vi.clearAllMocks();
  });

  it('should generate correct schema using agent template', () => {
    const builder = new AgentUnitTestBuilder('MyAgent', '../agent/MyAgent');
    builder.ensure(sourceFile);

    expect(TemplateLoader.load).toHaveBeenCalledWith(
      'test/unit/agent.tsf',
      expect.objectContaining({
        className: 'MyAgent',
        agentPath: '../agent/MyAgent',
      }),
    );
    expect(sourceFile.getFullText()).toContain('// Mock content for test/unit/agent.tsf');
  });
});
