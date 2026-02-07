/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { FormBuilder } from '../../../../../src/engine/builders/ui/form-builder.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('FormBuilder', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  it('should generate form component for models', async () => {
    // Mock ui.yaml and models
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml'))
        return 'backend: "user-api"\ntables:\n  User: {}\nforms:\n  User: {}';
      if (String(path).endsWith('models.yaml')) {
        return `
models:
  User:
    api: true
    fields:
      id: { type: String }
      email: { type: String }
      age: { type: Int }
      active: { type: Boolean }
`;
      }
      return '';
    });

    const builder = new FormBuilder('test-ui', { name: 'test-ui' });
    await builder.build(project, undefined);

    const sourceFile = project
      .getSourceFiles()
      .find((f) => f.getFilePath().endsWith('UserForm.tsx'));
    expect(sourceFile).toBeDefined();

    const text = sourceFile?.getFullText();
    expect(text).toContain('export function UserForm');
    expect(text).toContain('useForm<FormData>');
    expect(text).toContain('zodResolver(schema)');
    expect(text).toContain("register('email')");
    expect(text).toContain('valueAsNumber: true'); // for age (Int)
    expect(text).toContain('type="checkbox"'); // for active (Boolean)
    expect(text).toContain('useCreateUser');
    expect(text).toContain('useUpdateUser');
  });
});
