/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Project } from 'ts-morph';
import { TableBuilder } from '../../../../../src/engine/builders/ui/table-builder.js';
import * as fs from 'node:fs';
import { ModuleLocator } from '../../../../../src/lib/module-locator.js';

vi.mock('node:fs');

describe('TableBuilder - Exhaustive Coverage', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle no models', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('backend: "user-api"');
    vi.spyOn(ModuleLocator, 'resolve').mockReturnValue({
      name: 'user-api',
      path: 'user-api',
    } as unknown as { name: string; path: string });

    const builder = new TableBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should skip models without API', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'tables: { NoApi: {} }';
      if (String(path).endsWith('models.yaml'))
        return 'models: { NoApi: { api: false, fields: { name: string } } }';
      return '';
    });
    vi.spyOn(ModuleLocator, 'resolve').mockReturnValue({
      name: 'test-ui',
      path: 'test-ui',
    } as unknown as { name: string; path: string });

    const builder = new TableBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should generate table with dialog editMode', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'tables: { User: { editMode: "dialog" } }';
      if (String(path).endsWith('models.yaml'))
        return 'models: { User: { role: "admin", fields: { name: string } } }';
      return '';
    });
    vi.spyOn(ModuleLocator, 'resolve').mockReturnValue({
      name: 'test-ui',
      path: 'test-ui',
    } as unknown as { name: string; path: string });

    const builder = new TableBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const file = project.getSourceFile('test-ui/src/components/UserTable.tsx');
    expect(file).toBeDefined();
    const text = file?.getFullText();
    expect(text).toContain('Dialog');
    expect(text).not.toContain('Sheet');
    expect(text).toContain('DataTable');
  });

  it('should filter private, Json, and relation fields', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'tables: { User: {} }';
      if (String(path).endsWith('models.yaml'))
        return `
models:
  User:
    role: "admin"
    fields:
      id: string
      bio: { type: "string", private: true }
      config: { type: "Json" }
      posts: { type: "Post", isRelation: true }
  Post:
    fields:
      title: string
`;
      return '';
    });
    vi.spyOn(ModuleLocator, 'resolve').mockReturnValue({
      name: 'test-ui',
      path: 'test-ui',
    } as unknown as { name: string; path: string });

    const builder = new TableBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const file = project.getSourceFile('test-ui/src/components/UserTable.tsx');
    expect(file).toBeDefined();
    const text = file?.getFullText();
    expect(text).toContain("accessorKey: 'id'");
    expect(text).not.toContain("accessorKey: 'bio'");
    expect(text).not.toContain("accessorKey: 'config'");
    expect(text).not.toContain("accessorKey: 'posts'");
  });
});
