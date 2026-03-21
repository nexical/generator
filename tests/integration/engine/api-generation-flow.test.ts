/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiModuleGenerator } from '@nexical/generator/engine/api-module-generator.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ApiModuleGenerator - Functional Integration Flow', () => {
  const mockPkgPath = '/tmp/generator-integration-test';

  beforeEach(async () => {
    vi.clearAllMocks();
    if (fs.existsSync(mockPkgPath)) {
      fs.rmSync(mockPkgPath, { recursive: true, force: true });
    }
    fs.mkdirSync(mockPkgPath, { recursive: true });
    fs.mkdirSync(path.join(mockPkgPath, 'src/actions'), { recursive: true });
    fs.mkdirSync(path.join(mockPkgPath, 'src/services'), { recursive: true });
    fs.mkdirSync(path.join(mockPkgPath, 'src/pages/api'), { recursive: true });
    fs.mkdirSync(path.join(mockPkgPath, 'tests/unit/services'), { recursive: true });

    // Use real TemplateLoader FS
    const realFs = await vi.importActual<typeof fs>('node:fs');
    TemplateLoader.setFileSystem(realFs as typeof fs);
  });

  it('should generate a full API module and tests without rendering errors', async () => {
    const modelsYaml = `
models:
  User:
    api: true
    db: true
    fields:
      name: { type: String }
      email: { type: String }
      createdAt: { type: DateTime }

  Post:
    api: true
    db: true
    fields:
      title: { type: String }
      userId: { type: String }
`;

    const apiYaml = `
models:
  User:
    - path: /me
      method: getMe
      verb: GET
      input: none
      output: User
    - path: /login
      method: login
      verb: POST
      input: LoginDTO
      output: User
`;

    fs.writeFileSync(path.join(mockPkgPath, 'models.yaml'), modelsYaml);
    fs.writeFileSync(path.join(mockPkgPath, 'api.yaml'), apiYaml);

    // Mock Service with a custom method to trigger test generation
    const userServiceContent = `
export class UserService {
    static async getMe() { return { success: true, data: { name: 'test' } }; }
    static async list() { return { success: true, data: [] }; }
}
`;
    fs.writeFileSync(path.join(mockPkgPath, 'src/services/user-service.ts'), userServiceContent);

    const generator = new ApiModuleGenerator(mockPkgPath);

    // We want to test REAL generation, but we don't want it to actually write to the real FS in some places,
    // though for this test writing to /tmp is fine.
    await generator.run();

    // Verify User API file exists and is valid (no obvious rendering junk)
    const userApiFile = path.join(mockPkgPath, 'src/pages/api/user/index.ts');
    expect(fs.existsSync(userApiFile)).toBe(true);
    const content = fs.readFileSync(userApiFile, 'utf-8');
    expect(content).toContain('defineApi');
    expect(content).not.toContain('${'); // No un-interpolated variables
    expect(content).not.toContain('undefined'); // No obvious JS artifacts

    // Verify User Service Unit Test
    const userTestFile = path.join(mockPkgPath, 'tests/unit/services/user-service.test.ts');
    expect(fs.existsSync(userTestFile)).toBe(true);
    const testContent = fs.readFileSync(userTestFile, 'utf-8');
    expect(testContent).toContain(
      'import { UserService } from "../../../src/services/user-service"',
    );
    // Check if it reached root correctly: tests/unit/services/ -> ../../../ is root.
    // 1. ../ (services/)
    // 2. ../../ (unit/)
    // 3. ../../../ (tests/) -- Wait, I said 3 levels before.
    // tests/unit/services/foo.test.ts
    // parent is tests/unit/services/
    // ../ is tests/unit/
    // ../../ is tests/
    // ../../../ is root.
    // So ../../../src/services/user-service.ts is correct.
  });
});
