import { describe, it, expect, vi, beforeEach } from 'vitest';
import { specUpdateModule } from '../../../src/lib/spec-update.js';
import fs from 'node:fs';
import YAML from 'yaml';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

describe('specUpdateModule Unit', () => {
  let command: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    command = {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Record<string, unknown>;
  });

  it('should add a model to models.yaml', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('models: {}');

    await specUpdateModule(command as any, '/test', { add: 'NewModel' });

    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(command.success).toHaveBeenCalledWith(expect.stringContaining('Updated models.yaml'));
  });

  it('should create models.yaml if missing and add model', async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => String(p) === '/test' || !String(p).endsWith('models.yaml'),
    );
    vi.mocked(fs.readFileSync).mockReturnValue('');
    await specUpdateModule(command as any, '/test', { add: 'MissingModel' });
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should report model already exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(YAML.stringify({ models: { NewModel: {} } }));

    await specUpdateModule(command as any, '/test', { add: 'NewModel' });

    expect(command.warn).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });

  it('should add a route to api.yaml', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('routes: {}');

    await specUpdateModule(command as any, '/test', { route: 'Model:/new:POST' });

    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(command.success).toHaveBeenCalledWith(expect.stringContaining('Updated api.yaml'));
  });

  it('should create api.yaml if missing and add route', async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => String(p) === '/test' || !String(p).endsWith('api.yaml'),
    );
    vi.mocked(fs.readFileSync).mockReturnValue('');
    await specUpdateModule(command as any, '/test', { route: 'NewModel:/new:POST' });
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should report route already exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      YAML.stringify({
        routes: { Model: [{ path: '/new', method: 'POST' }] },
      }),
    );

    await specUpdateModule(command as any, '/test', { route: 'Model:/new:POST' });

    expect(command.warn).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });

  it('should report invalid route format', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    await specUpdateModule(command as any, '/test', { route: 'invalid' });
    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('Invalid route format'));
  });

  it('should report path not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await specUpdateModule(command as any, '/invalid', { add: 'Model' });
    expect(command.error).toHaveBeenCalledWith(expect.stringContaining('Path does not exist'));
  });
});
