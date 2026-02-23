import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { createMockCommand } from '../helpers/mock-command.js';

// We spy on ModuleLocator so we can point it at our temp directory
// without requiring the whole monorepo structure to exist.
vi.mock('../../../src/lib/module-locator.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/lib/module-locator.js')>();
  return {
    ...original,
    ModuleLocator: {
      ...original.ModuleLocator,
      expand: vi.fn(),
      resolve: vi.fn(),
    },
  };
});

import { ModuleLocator } from '../../../src/lib/module-locator.js';
import { generateApiModule } from '../../../src/lib/generate-api.js';
import { ApiModuleGenerator } from '../../../src/engine/api-module-generator.js';

const MINIMAL_MODELS_YAML = `
models:
  Widget:
    fields:
      id:
        type: String
        attributes:
          - "@id"
          - "@default(cuid())"
      name:
        type: String
      createdAt:
        type: DateTime
        attributes:
          - "@default(now())"
      updatedAt:
        type: DateTime
        attributes:
          - "@updatedAt"
`;

const MODELS_NO_FIELDS_YAML = `
models:
`;

describe('generate-api Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexical-gen-api-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should generate all expected files for a minimal models.yaml', async () => {
    const modelsPath = path.join(tmpDir, 'models.yaml');
    await fs.writeFile(modelsPath, MINIMAL_MODELS_YAML);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await generateApiModule(command, 'widget-api');

    expect(command.success).toHaveBeenCalledWith(expect.stringContaining('Successfully generated'));

    // Core generated files must exist
    expect(fs.existsSync(path.join(tmpDir, 'src/sdk/types.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/services/widget-service.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/pages/api/widget/index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/pages/api/widget/[id].ts'))).toBe(true);
  });

  it('should generate SDK types with correct model type exports', async () => {
    const modelsPath = path.join(tmpDir, 'models.yaml');
    await fs.writeFile(modelsPath, MINIMAL_MODELS_YAML);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await generateApiModule(command, 'widget-api');

    const typesContent = await fs.readFile(path.join(tmpDir, 'src/sdk/types.ts'), 'utf-8');
    expect(typesContent).toContain('Widget');
  });

  it('should generate a service with CRUD methods', async () => {
    const modelsPath = path.join(tmpDir, 'models.yaml');
    await fs.writeFile(modelsPath, MINIMAL_MODELS_YAML);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await generateApiModule(command, 'widget-api');

    const serviceContent = await fs.readFile(
      path.join(tmpDir, 'src/services/widget-service.ts'),
      'utf-8',
    );
    expect(serviceContent).toContain('WidgetService');
    // Service generates list, get, create, update, delete
    expect(serviceContent).toContain('list');
    expect(serviceContent).toContain('get');
    expect(serviceContent).toContain('create');
    expect(serviceContent).toContain('delete');
  });

  it('should generate API handlers with Zod validation schema', async () => {
    const modelsPath = path.join(tmpDir, 'models.yaml');
    await fs.writeFile(modelsPath, MINIMAL_MODELS_YAML);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await generateApiModule(command, 'widget-api');

    const collectionContent = await fs.readFile(
      path.join(tmpDir, 'src/pages/api/widget/index.ts'),
      'utf-8',
    );
    expect(collectionContent).toContain('z.object');
    expect(collectionContent).toContain('export const GET');
  });

  it('should generate a custom API route from api.yaml', async () => {
    const modelsPath = path.join(tmpDir, 'models.yaml');
    await fs.writeFile(modelsPath, MINIMAL_MODELS_YAML);
    const apiYamlContent = `
Widget:
  - path: /export
    verb: POST
    method: exportWidgets
    name: exportWidgets
    input: none
    output: none
`;
    await fs.writeFile(path.join(tmpDir, 'api.yaml'), apiYamlContent);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await generateApiModule(command, 'widget-api');

    // The custom route generates a route file AND an action file
    // Check either the route file or action file was created
    const srcPagesDir = path.join(tmpDir, 'src/pages/api/widget');
    const srcActionsDir = path.join(tmpDir, 'src/actions');
    // At minimum, the generator ran successfully without error
    expect(command.error).not.toHaveBeenCalled();
    // Route file or action stub should exist
    const routeExists = fs.existsSync(path.join(srcPagesDir, 'export.ts'));
    const actionsExist = fs.existsSync(srcActionsDir);
    expect(routeExists || actionsExist).toBe(true);
  });

  it('should be idempotent: running generator twice produces stable files', async () => {
    const modelsPath = path.join(tmpDir, 'models.yaml');
    await fs.writeFile(modelsPath, MINIMAL_MODELS_YAML);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });

    // First run
    await generateApiModule(command, 'widget-api');
    const serviceAfterFirst = await fs.readFile(
      path.join(tmpDir, 'src/services/widget-service.ts'),
      'utf-8',
    );

    // Second run (simulating re-run)
    vi.clearAllMocks();
    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'widget-api', path: tmpDir, app: 'backend' },
    ]);
    await generateApiModule(command, 'widget-api');
    const serviceAfterSecond = await fs.readFile(
      path.join(tmpDir, 'src/services/widget-service.ts'),
      'utf-8',
    );

    // Same content means reconciler is stable
    expect(serviceAfterSecond).toEqual(serviceAfterFirst);
  });

  it('should scaffold project files (package.json, tsconfig.json) for a new module', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);
    vi.mocked(ModuleLocator.resolve).mockReturnValue({
      name: 'newmodule-api',
      path: tmpDir,
      app: 'backend',
    });

    // Write models.yaml so generator has something to process
    await fs.writeFile(path.join(tmpDir, 'models.yaml'), MINIMAL_MODELS_YAML);

    const command = createMockCommand({ errorThrows: false });
    await generateApiModule(command, 'newmodule-api');

    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'tsconfig.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'module.config.mjs'))).toBe(true);

    const pkg = await fs.readJSON(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('@modules/newmodule-api');
  });

  it('should skip generation and log message when models.yaml has no models', async () => {
    const modelsPath = path.join(tmpDir, 'models.yaml');
    await fs.writeFile(modelsPath, MODELS_NO_FIELDS_YAML);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    vi.mocked(ModuleLocator.expand).mockResolvedValue([
      { name: 'empty-api', path: tmpDir, app: 'backend' },
    ]);

    const command = createMockCommand({ errorThrows: false });
    await generateApiModule(command, 'empty-api');

    // No service generated
    expect(fs.existsSync(path.join(tmpDir, 'src/services'))).toBe(false);
    // Info should include the skip message
    const infoMessages: string[] = vi.mocked(command.info).mock.calls.flat().map(String);
    expect(infoMessages.some((m) => m.includes('Skipping') || m.includes('No models'))).toBe(true);
  });

  it('should warn when a glob pattern matches no modules', async () => {
    vi.mocked(ModuleLocator.expand).mockResolvedValue([]);

    const command = createMockCommand({ errorThrows: false });
    await generateApiModule(command, '*-api');

    expect(command.warn).toHaveBeenCalledWith(
      expect.stringContaining('No modules found matching pattern "*-api"'),
    );
  });

  it('should directly invoke ApiModuleGenerator for real file output', async () => {
    await fs.writeFile(path.join(tmpDir, 'models.yaml'), MINIMAL_MODELS_YAML);
    await fs.ensureDir(path.join(tmpDir, 'src'));

    const generator = new ApiModuleGenerator(tmpDir, {});
    await generator.run();

    expect(fs.existsSync(path.join(tmpDir, 'src/sdk/types.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'src/services/widget-service.ts'))).toBe(true);
  });
});
