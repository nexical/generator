import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { generateApiModule } from '../../../src/lib/generate-api.js';
import { ModuleLocator } from '../../../src/lib/module-locator.js';

vi.mock('../../../src/lib/module-locator.js', () => ({
  ModuleLocator: {
    expand: vi.fn(),
    resolve: vi.fn(),
  },
}));

vi.mock('../../../src/engine/api-module-generator.js', () => {
  return {
    ApiModuleGenerator: vi.fn().mockImplementation(function () {
      return {
        run: vi.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  ensureDir: vi.fn(),
  writeJSON: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('fs-extra', () => ({
  default: mockFs,
  ...mockFs,
}));

describe('generateApiModule', () => {
  let mockCommand: { info: Mock; warn: Mock; error: Mock; success: Mock };

  beforeEach(() => {
    mockCommand = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn((msg) => {
        console.error('Command Error:', msg);
      }),
      success: vi.fn(),
    };
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.ensureDir.mockResolvedValue(undefined);
    mockFs.writeJSON.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  it('should generate all modules when name is "all"', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'api-1', path: '/p1', app: 'backend' },
      { name: 'api-2', path: '/p2', app: 'backend' },
    ]);

    await generateApiModule(
      mockCommand as unknown as import('@nexical/cli-core').BaseCommand,
      'all',
    );
    expect(mockCommand.info).toHaveBeenCalledWith(
      expect.stringContaining('Found 2 module(s) to generate.'),
    );
  });

  it('should handle no modules found and skip magic pattern warning if it has magic', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    // Pattern with magic
    await generateApiModule(
      mockCommand as unknown as import('@nexical/cli-core').BaseCommand,
      '*-api',
    );
    expect(mockCommand.warn).toHaveBeenCalledWith(
      expect.stringContaining('No modules found matching pattern "*-api"'),
    );
  });

  it('should resolve and generate when specific name is provided but not found', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    vi.mocked(ModuleLocator.resolve).mockReturnValue({
      name: 'new-api',
      path: '/new',
      app: 'backend',
    });
    mockFs.existsSync.mockReturnValue(false); // Trigger "Module 'new-api' does not exist. Creating..."

    await generateApiModule(
      mockCommand as unknown as import('@nexical/cli-core').BaseCommand,
      'new-api',
    );
    expect(mockCommand.error).not.toHaveBeenCalled();
    expect(mockCommand.info).toHaveBeenCalledWith(
      expect.stringContaining("Module 'new-api' does not exist. Creating..."),
    );
    expect(mockCommand.success).toHaveBeenCalledWith(
      expect.stringContaining('Successfully generated code for "new-api"'),
    );
  });
});
