import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { ModuleGenerator } from '../../../src/engine/module-generator.js';
import { type SourceFile } from 'ts-morph';
import { BuilderLoader } from '../../../src/engine/builder-loader.js';
import { TemplateLoader } from '../../../src/utils/template-loader.js';

vi.mock('../../../src/engine/builder-loader.js', () => ({
  BuilderLoader: {
    loadAndRun: vi.fn(),
  },
}));

vi.mock('../../../src/utils/template-loader.js', () => ({
  TemplateLoader: {
    setModulePath: vi.fn(),
  },
}));

class TestModuleGenerator extends ModuleGenerator {
  async run(): Promise<void> {
    this.getOrCreateFile('src/test.ts');
    await this.saveAll();
  }

  public exposeGetOrCreateFile(filePath: string): SourceFile {
    return this.getOrCreateFile(filePath);
  }

  public exposeCleanup(targetDir: string, pattern: RegExp): void {
    this.cleanup(targetDir, pattern);
  }

  public async exposeSaveAll(): Promise<void> {
    await this.saveAll();
  }

  public async exposeRunCustomBuilders(context?: Record<string, unknown>): Promise<void> {
    await this.runCustomBuilders(context);
  }

  public getModulePath(): string {
    return this.modulePath;
  }

  public getModuleName(): string {
    return this.moduleName;
  }

  public getGeneratedFiles(): Set<string> {
    return this.generatedFiles;
  }
}

describe('ModuleGenerator', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexical-module-generator-test-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
    vi.clearAllMocks();
  });

  it('should initialize with correct module name and path', () => {
    const generator = new TestModuleGenerator(tmpDir);
    expect(path.resolve(generator.getModulePath())).toBe(path.resolve(tmpDir));
    expect(generator.getModuleName()).toBe(path.basename(tmpDir));
  });

  it('should create and load files correctly', () => {
    const generator = new TestModuleGenerator(tmpDir);
    const file = generator.exposeGetOrCreateFile('src/index.ts');

    expect(file).toBeDefined();
    expect(file.getFilePath()).toContain('src/index.ts');
    expect(generator.getGeneratedFiles().has(file.getFilePath())).toBe(true);
  });

  it('should handle existing files', async () => {
    const filePath = path.join(tmpDir, 'src/existing.ts');
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, 'export const a = 1;');

    const generator = new TestModuleGenerator(tmpDir);
    const file = generator.exposeGetOrCreateFile('src/existing.ts');

    expect(file.getFullText()).toContain('export const a = 1;');
  });

  it('should evict cache if file is already in project but not in generatedFiles set', () => {
    const generator = new TestModuleGenerator(tmpDir);
    const file1 = generator.exposeGetOrCreateFile('src/test.ts');
    const filePath = file1.getFilePath();

    // Simulate re-creation without the set
    generator.getGeneratedFiles().delete(filePath);
    const file2 = generator.exposeGetOrCreateFile('src/test.ts');

    expect(file1).not.toBe(file2); // Should have been removed and re-added
  });

  it('should cleanup generated files recursively', async () => {
    const generator = new TestModuleGenerator(tmpDir);
    const genPath = path.join(tmpDir, 'src/gen.ts');
    const nestedGenPath = path.join(tmpDir, 'src/nested/gen.ts');
    const manualPath = path.join(tmpDir, 'src/manual.ts');

    await fs.ensureDir(path.join(tmpDir, 'src/nested'));
    await fs.writeFile(genPath, '// GENERATED CODE - DO NOT MODIFY\nexport const a = 1;');
    await fs.writeFile(nestedGenPath, '// GENERATED CODE - DO NOT MODIFY\nexport const b = 2;');
    await fs.writeFile(manualPath, 'export const c = 3;');

    generator.exposeCleanup('src', /\.ts$/);

    expect(fs.existsSync(genPath)).toBe(false);
    expect(fs.existsSync(nestedGenPath)).toBe(false);
    expect(fs.existsSync(manualPath)).toBe(true);
  });

  it('should run custom builders and hit branch with lambda', async () => {
    const generator = new TestModuleGenerator(tmpDir);
    await generator.exposeRunCustomBuilders({ foo: 'bar' });

    expect(TemplateLoader.setModulePath).toHaveBeenCalledWith(path.resolve(tmpDir));
    const loadAndRunCall = vi.mocked(BuilderLoader.loadAndRun).mock.calls[0];
    const callback = loadAndRunCall[3] as (p: string) => SourceFile;

    const file = callback('src/lambda-test.ts');
    expect(file).toBeDefined();
    expect(generator.getGeneratedFiles().has(file.getFilePath())).toBe(true);
  });

  it('should save all generated files and hoist header', async () => {
    const generator = new TestModuleGenerator(tmpDir);
    const file = generator.exposeGetOrCreateFile('src/save-test.ts');
    file.addVariableStatement({
      declarationKind: 'const' as import('ts-morph').VariableDeclarationKind,
      declarations: [{ name: 'x', initializer: '1' }],
      isExported: true,
    });
    file.insertText(0, '// GENERATED CODE - DO NOT MODIFY\n');

    await generator.exposeSaveAll();

    const savedContent = await fs.readFile(path.join(tmpDir, 'src/save-test.ts'), 'utf-8');
    expect(savedContent.startsWith('// GENERATED CODE - DO NOT MODIFY')).toBe(true);
    expect(savedContent).toContain('export const x = 1');
  });

  it('should create directories during save', async () => {
    const generator = new TestModuleGenerator(tmpDir);
    generator.exposeGetOrCreateFile('src/nested/dir/test.ts');

    // Remove directory before save to test creation
    await fs.remove(path.join(tmpDir, 'src/nested'));

    await generator.exposeSaveAll();

    expect(fs.existsSync(path.join(tmpDir, 'src/nested/dir/test.ts'))).toBe(true);
  });
});
