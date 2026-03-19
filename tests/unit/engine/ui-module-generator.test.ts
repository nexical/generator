import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs';
import { UiModuleGenerator } from '@nexical/generator/engine/ui-module-generator.js';
import { PathResolver } from '@nexical/generator/utils/path-resolver.js';

vi.mock('@nexical/generator/utils/path-resolver.js', () => ({
  PathResolver: {
    resolve: vi.fn(),
    init: vi.fn(),
    getDefaults: vi.fn().mockReturnValue({
      superRole: 'USER_ADMIN',
      defaultRole: 'USER_EMPLOYEE',
    }),
  },
}));

describe('UiModuleGenerator Integration-Style Unit Test', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `ui-module-gen-integ-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should generate UI files for a simple module', async () => {
    const modulePath = path.join(tmpDir, 'apps/frontend/modules/user-ui');
    const backendPath = path.join(tmpDir, 'apps/backend/modules/user-api');

    fs.mkdirSync(modulePath, { recursive: true });
    fs.mkdirSync(backendPath, { recursive: true });

    // Setup mock to return temporary paths
    vi.mocked(PathResolver.resolve).mockImplementation((name: string) => {
      if (name === 'user-api') return backendPath;
      if (name === 'user-ui') return modulePath;
      return path.join(tmpDir, name);
    });

    const modelsYaml = `
models:
  User:
    fields:
      name: String
    api: true
`;
    const uiYaml = `
backend: user-api
pages:
  - path: /users
    component: UserListPage
    guard: ["admin"]
forms:
  User:
    name:
      component:
        name: Input
        path: "@/components/ui/input"
tables:
  User:
    editMode: sheet
`;

    fs.writeFileSync(
      path.join(backendPath, 'access.yaml'),
      'roles:\n  admin:\n    permissions: ["*"]',
    );
    fs.writeFileSync(path.join(backendPath, 'models.yaml'), modelsYaml);
    fs.writeFileSync(path.join(modulePath, 'models.yaml'), modelsYaml);
    fs.writeFileSync(path.join(modulePath, 'ui.yaml'), uiYaml);

    // Ensure src/components exists
    fs.mkdirSync(path.join(modulePath, 'src/components'), { recursive: true });

    const generator = new UiModuleGenerator(modulePath);
    await generator.run();

    const listFiles = (dir: string): string[] => {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).flatMap((file) => {
        const fullPath = path.join(dir, file);
        return fs.statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath];
      });
    };

    const files = listFiles(modulePath);

    // Robust check for files
    const hasMiddleware = files.some((f) => f.endsWith('middleware.ts'));
    const hasForm = files.some((f) => f.endsWith('UserForm.tsx'));
    const hasTable = files.some((f) => f.endsWith('UserTable.tsx'));
    const hasAdminRole = files.some((f) => f.endsWith('roles/admin.ts'));
    const hasBaseRole = files.some((f) => f.endsWith('roles/base-role.ts'));

    expect(hasMiddleware).toBe(true);
    expect(hasForm).toBe(true);
    expect(hasTable).toBe(true);
    expect(hasAdminRole).toBe(true);
    expect(hasBaseRole).toBe(true);
  });
});
