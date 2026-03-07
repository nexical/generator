import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormBuilder } from '../../../../../src/engine/builders/ui/form-builder.js';
import { Project } from 'ts-morph';
import { type ModelDef, type ModuleConfig } from '../../../../../src/engine/types.js';
import path from 'node:path';
import * as fs from 'node:fs';
import os from 'node:os';

describe('FormBuilder - Coverage Boost', () => {
  let tmpDir: string;
  let modulePath: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `form-builder-cov-${Math.random().toString(36).slice(2)}`);
    modulePath = path.join(tmpDir, 'apps/frontend/modules/test-ui');
    fs.mkdirSync(path.join(modulePath, 'src/components'), { recursive: true });
    fs.mkdirSync(path.join(modulePath, 'src/hooks'), { recursive: true });
  });

  const makeModel = (fields: Record<string, unknown>): ModelDef =>
    ({
      name: 'User',
      api: true,
      db: true,
      fields: Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [
          k,
          {
            type: 'String',
            isRequired: true,
            isList: false,
            isRelation: false,
            isEnum: false,
            api: true,
            attributes: [],
            ...(v as object),
          },
        ]),
      ),
    }) as unknown as ModelDef;

  it('should generate form with different field types (Int, Boolean, DateTime)', async () => {
    const model = makeModel({
      age: { type: 'Int' },
      active: { type: 'Boolean' },
      birthday: { type: 'DateTime' },
    });

    const config: ModuleConfig = {
      name: 'test-ui',
      variables: [],
    };

    const uiYaml = `
forms:
  User:
    age: {}
    active: {}
    birthday: {}
`;
    fs.writeFileSync(path.join(modulePath, 'ui.yaml'), uiYaml);

    const builder = new FormBuilder('test-ui', config, modulePath);
    // Mock resolveModels
    vi.spyOn(
      builder as unknown as { resolveModels: () => ModelDef[] },
      'resolveModels',
    ).mockReturnValue([model]);

    const project = new Project();
    await builder.build(project, undefined);

    const formFile = project.getSourceFiles().find((f) => f.getBaseName() === 'UserForm.tsx');
    expect(formFile).toBeDefined();
    const text = formFile!.getFullText();

    expect(text).toContain('type="number"');
    expect(text).toContain('type="checkbox"');
    expect(text).toContain('type="datetime-local"');
  });

  it('should handle enum fields with Select component', async () => {
    const model = makeModel({
      role: { type: 'Role', isEnum: true, enumValues: ['ADMIN', 'USER'] },
    });

    const config: ModuleConfig = { name: 'test-ui' } as any;
    fs.writeFileSync(path.join(modulePath, 'ui.yaml'), 'forms: { User: { role: {} } }');

    const builder = new FormBuilder('test-ui', config, modulePath);
    vi.spyOn(builder as any, 'resolveModels').mockReturnValue([model]);

    const project = new Project();
    await builder.build(project, undefined);

    const text = project.getSourceFiles()[0].getFullText();
    expect(text).toContain('Controller');
    expect(text).toContain('Select');
    expect(text).toContain('SelectItem');
    expect(text).toContain('ADMIN');
  });

  it('should handle custom component overrides', async () => {
    const model = makeModel({
      bio: { type: 'String' },
    });

    const config: ModuleConfig = { name: 'test-ui' } as any;
    fs.writeFileSync(
      path.join(modulePath, 'ui.yaml'),
      `
forms:
  User:
    bio:
      component:
        name: MyTextArea
        path: '@/components/MyTextArea'
`,
    );

    const builder = new FormBuilder('test-ui', config, modulePath);
    vi.spyOn(builder as any, 'resolveModels').mockReturnValue([model]);

    const project = new Project();
    await builder.build(project, undefined);

    const text = project.getSourceFiles()[0].getFullText();
    expect(text).toContain('MyTextArea');
    expect(text).toContain('@/components/MyTextArea');
    expect(text).toContain('<MyTextArea');
  });

  it('should skip fields correctly (id, passwordUpdatedAt, etc)', async () => {
    const model = makeModel({
      id: { type: 'String' },
      emailVerified: { type: 'DateTime' },
      name: { type: 'String' },
    });

    const config: ModuleConfig = { name: 'test-ui' } as any;
    fs.writeFileSync(
      path.join(modulePath, 'ui.yaml'),
      'forms: { User: { name: {}, id: {}, emailVerified: {} } }',
    );

    const builder = new FormBuilder('test-ui', config, modulePath);
    vi.spyOn(builder as any, 'resolveModels').mockReturnValue([model]);

    const project = new Project();
    await builder.build(project, undefined);

    const text = project.getSourceFiles()[0].getFullText();
    expect(text).toContain('name');
    expect(text).not.toContain('htmlFor="id"');
    expect(text).not.toContain('htmlFor="emailVerified"');
  });
});
