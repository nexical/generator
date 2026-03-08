/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Project } from 'ts-morph';
import { FormBuilder } from '../../../../../src/engine/builders/ui/form-builder.js';
import * as fs from 'node:fs';
import { ModelParser } from '../../../../../src/engine/model-parser.js';

vi.mock('node:fs');

describe('FormBuilder - Exhaustive Coverage', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should skip models not in forms config', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'backend: "user-api"\nforms:\n  InForm: {}';
      if (String(path).endsWith('models.yaml')) {
        return `
models:
  InForm: { api: true, fields: {} }
  NotInForm: { api: true, fields: {} }
`;
      }
      return '';
    });

    const builder = new FormBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    
    expect(project.getSourceFiles().length).toBe(1);
    expect(project.getSourceFiles()[0].getFilePath()).toContain('InFormForm.tsx');
  });

  it('should handle empty models or missing UI config', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'backend: "user-api"\nforms: {}'; // Empty forms
      if (String(path).endsWith('models.yaml')) return 'models: {}'; // Empty models
      return '';
    });

    const builder = new FormBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    expect(project.getSourceFiles().length).toBe(0);
  });

  it('should handle models without API or not in forms config', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'backend: "user-api"\nforms:\n  ModelWithNoApi: {}\n  OtherModel: {}';
      if (String(path).endsWith('models.yaml')) {
        return `
models:
  ModelWithNoApi:
    api: false
    fields:
      name: { type: String }
  OtherModel:
    api: true
    fields:
      name: { type: String }
`;
      }
      return '';
    });

    const builder = new FormBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);
    // OtherModel is in forms and has API. ModelWithNoApi has no API even if in forms. 
    // Wait, OtherModel is in ui.yaml forms, so it should be generated.
    expect(project.getSourceFiles().length).toBe(1);
    expect(project.getSourceFiles()[0].getFilePath()).toContain('OtherModelForm.tsx');
  });

  it('should cover custom component imports and field types', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) {
        return `
backend: "user-api"
forms:
  User:
    avatar:
      component:
        name: "AvatarUploader"
        path: "@/components/custom/AvatarUploader"
`;
      }
      if (String(path).endsWith('models.yaml')) {
        return `
models:
  User:
    api: true
    fields:
      avatar: { type: String, private: true } # Private but in forms
      score: { type: Float }
      birthday: { type: DateTime }
      bio: { type: Json } # Should be filtered out
      secret: { type: String, private: true } # Filtered out (private and NOT in forms)
      friends: { type: User, isRelation: true } # Filtered out
`;
      }
      return '';
    });

    const builder = new FormBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const sourceFile = project.getSourceFiles()[0];
    const text = sourceFile.getFullText();

    expect(text).toContain('import { AvatarUploader } from "@/components/custom/AvatarUploader"');
    expect(text).toContain('<AvatarUploader');
    expect(text).toContain('type="number"'); // for Float
    expect(text).toContain('type="datetime-local"'); // for DateTime
    expect(text).not.toContain('<input type="text" id="bio"'); // bio is in schema but NOT in JSX
    expect(text).not.toContain('secret');
    expect(text).not.toContain('friends');
  });

  it('should cover specific model replacements for SiteRole and UserStatus', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'backend: "user-api"\nforms:\n  User: {}';
      return '';
    });

    // Spy on ModelParser.parse to return exactly what we need for coverage
    vi.spyOn(ModelParser, 'parse').mockReturnValue({
      models: [
        {
          name: 'User',
          api: true,
          fields: {
            role: { type: 'SiteRole', isEnum: true, isRequired: true, attributes: [] } as any,
            status: { type: 'UserStatus', isEnum: true, isRequired: true, attributes: [] } as any,
          },
        } as any,
      ],
      enums: [],
      config: {},
    });

    const builder = new FormBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const text = project.getSourceFiles()[0].getFullText();
    expect(text).toContain('nativeEnum(UserModuleTypes.SiteRole)');
    expect(text).toContain('nativeEnum(UserModuleTypes.UserStatus)');
  });

  it('should handle model name ending in ModuleTypes for Enum Selects', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith('ui.yaml')) return 'backend: "user-api"\nforms:\n  AuthModuleTypes: {}';
      if (String(path).endsWith('models.yaml')) {
        return `
enums:
  Status:
    values: [ACTIVE, INACTIVE]
models:
  AuthModuleTypes:
    api: true
    fields:
      status: { type: Status }
`;
      }
      return '';
    });

    const builder = new FormBuilder('test-ui', { name: 'test-ui' }, 'test-ui');
    await builder.build(project, undefined);

    const text = project.getSourceFiles()[0].getFullText();
    expect(text).toContain('AuthModuleTypes.Status.ACTIVE');
  });
});
