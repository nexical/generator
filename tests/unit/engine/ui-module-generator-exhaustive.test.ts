import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs';
import { UiModuleGenerator } from '../../../src/engine/ui-module-generator.js';
import { ModuleLocator } from '../../../src/lib/module-locator.js';

vi.mock('../../../src/lib/module-locator.js', () => ({
  ModuleLocator: {
    resolve: vi.fn(),
  },
}));

describe('UiModuleGenerator - Exhaustive Coverage', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `ui-module-gen-exhaustive-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // Default mock implementation
    vi.mocked(ModuleLocator.resolve).mockImplementation((name: string) => {
      return { name, path: path.join(tmpDir, name), app: name.endsWith('-ui') ? 'frontend' : 'backend' };
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should cover ui.yaml parsing failure (line 36)', async () => {
    const modulePath = path.join(tmpDir, 'test-ui');
    fs.mkdirSync(modulePath, { recursive: true });
    // Required models.yaml for FormBuilder/TableBuilder
    fs.writeFileSync(path.join(modulePath, 'models.yaml'), 'models: {}');
    fs.writeFileSync(path.join(modulePath, 'ui.yaml'), 'invalid: yaml: :'); // Corrupt YAML

    const generator = new UiModuleGenerator(modulePath);
    await generator.run();
    expect(fs.existsSync(path.join(modulePath, 'src/middleware.ts'))).toBe(true);
  });

  it('should cover access.yaml parsing failure (line 271)', async () => {
    const modulePath = path.join(tmpDir, 'test-ui');
    const backendPath = path.join(tmpDir, 'test-api');
    fs.mkdirSync(modulePath, { recursive: true });
    fs.mkdirSync(backendPath, { recursive: true });

    fs.writeFileSync(path.join(modulePath, 'models.yaml'), 'models: {}');
    fs.writeFileSync(path.join(backendPath, 'models.yaml'), 'models: {}');
    fs.writeFileSync(path.join(modulePath, 'ui.yaml'), 'backend: test-api');
    fs.writeFileSync(path.join(backendPath, 'access.yaml'), 'invalid: yaml: :'); // Corrupt YAML

    const generator = new UiModuleGenerator(modulePath);
    await generator.run();
    expect(fs.existsSync(path.join(modulePath, 'src/roles/base-role.ts'))).toBe(false);
  });

  it('should cover missing access.yaml branch (line 274)', async () => {
    const modulePath = path.join(tmpDir, 'test-ui');
    const backendPath = path.join(tmpDir, 'test-api');
    fs.mkdirSync(modulePath, { recursive: true });
    fs.mkdirSync(backendPath, { recursive: true });

    fs.writeFileSync(path.join(modulePath, 'models.yaml'), 'models: {}');
    fs.writeFileSync(path.join(backendPath, 'models.yaml'), 'models: {}');
    fs.writeFileSync(path.join(modulePath, 'ui.yaml'), 'backend: test-api');
    // NO access.yaml

    const generator = new UiModuleGenerator(modulePath);
    await generator.run();
    expect(fs.existsSync(path.join(modulePath, 'src/roles/base-role.ts'))).toBe(false);
  });

  it('should cover optimizeHybridRendering branches (lines 290-329)', async () => {
    const modulePath = path.join(tmpDir, 'test-ui');
    const pagesDir = path.join(modulePath, 'src/pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(modulePath, 'models.yaml'), 'models: {}');

    // 1. Page without PageGuard (skips)
    const page1Path = path.join(pagesDir, 'index.astro');
    fs.writeFileSync(page1Path, '---\nconst x = 1;\n---');

    // 2. Page with PageGuard, no prerender (injects)
    const page2Path = path.join(pagesDir, 'admin.astro');
    fs.writeFileSync(page2Path, '---\nimport { PageGuard } from "..."\nPageGuard.protect(...)\n---');

    // 3. Page with PageGuard AND prerender = false (skips)
    const page3Path = path.join(pagesDir, 'dashboard.astro');
    fs.writeFileSync(page3Path, '---\nexport const prerender = false;\nPageGuard.protect(...)\n---');

    // 4. Page with PageGuard, NO frontmatter (injects new)
    const page4Path = path.join(pagesDir, 'login.astro');
    fs.writeFileSync(page4Path, 'PageGuard.protect(...)');

    const generator = new UiModuleGenerator(modulePath);
    await generator.run();

    const page2Content = fs.readFileSync(page2Path, 'utf-8');
    expect(page2Content).toContain('export const prerender = false;');

    const page3Content = fs.readFileSync(page3Path, 'utf-8');
    expect(page3Content.split('export const prerender = false').length).toBe(2);

    const page4Content = fs.readFileSync(page4Path, 'utf-8');
    expect(page4Content).toContain('---\nexport const prerender = false;\n---');
  });

  it('should cover optimizeHybridRendering error path (line 326)', async () => {
    const modulePath = path.join(tmpDir, 'test-ui');
    const pagesDir = path.join(modulePath, 'src/pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(modulePath, 'models.yaml'), 'models: {}');

    // Create a directory where a file is expected to cause read/write failure if handled as file
    const pagePath = path.join(pagesDir, 'error.astro');
    fs.mkdirSync(pagePath); 

    const generator = new UiModuleGenerator(modulePath);
    // Should catch 'EISDIR' error and log warning
    await generator.run();
  });

  it('should cover successful role generation (lines 74-271)', async () => {
    const appsDir = path.join(tmpDir, 'apps');
    const frontendDir = path.join(appsDir, 'frontend/modules');
    const backendDir = path.join(appsDir, 'backend/modules');
    
    const modulePath = path.join(frontendDir, 'test-ui');
    const backendPath = path.join(backendDir, 'test-api');
    
    fs.mkdirSync(modulePath, { recursive: true });
    fs.mkdirSync(backendPath, { recursive: true });

    fs.writeFileSync(path.join(modulePath, 'models.yaml'), 'models: {}');
    fs.writeFileSync(path.join(backendPath, 'models.yaml'), 'models: {}');
    fs.writeFileSync(path.join(modulePath, 'ui.yaml'), 'backend: test-api');
    fs.writeFileSync(path.join(backendPath, 'access.yaml'), 'roles:\n  admin:\n    permissions: ["*"]');

    const generator = new UiModuleGenerator(modulePath);
    await generator.run();

    expect(fs.existsSync(path.join(modulePath, 'src/roles/base-role.ts'))).toBe(true);
    expect(fs.existsSync(path.join(modulePath, 'src/roles/admin.ts'))).toBe(true);
    expect(fs.existsSync(path.join(modulePath, 'src/roles/anonymous.ts'))).toBe(true);
    expect(fs.existsSync(path.join(modulePath, 'src/roles/member.ts'))).toBe(true);
  });
});
