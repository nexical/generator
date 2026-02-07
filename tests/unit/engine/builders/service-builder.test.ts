/** @vitest-environment node */
import { describe, it, expect, beforeEach } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { ServiceBuilder } from '../../../../src/engine/builders/service-builder.js';
import { type ModelDef } from '../../../../src/engine/types.js';

describe('ServiceBuilder', () => {
  let project: Project;
  let sourceFile: SourceFile;
  const model: ModelDef = {
    name: 'User',
    fields: {
      id: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
      name: { type: 'string', isRequired: true, isList: false, attributes: [], api: true },
    },
    api: true,
  };

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile('UserService.ts', '');
  });

  it('should generate a full CRUD service class with correct fragments', () => {
    const builder = new ServiceBuilder(model);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();

    // Structure Checks
    expect(text).toContain('export class UserService');

    // Fragment: List
    expect(text).toContain("HookSystem.filter('user.beforeList'");
    expect(text).toContain('db.user.findMany');
    expect(text).toContain('db.user.count');

    // Fragment: Create (Transaction & Hooks)
    expect(text).toContain('db.$transaction(async (tx) => {');
    expect(text).toContain('tx.user.create');
    expect(text).toContain(
      "HookSystem.dispatch('user.created', { id: created.id, actorId: actor?.id || 'system' });",
    );

    // Fragment: Update (Transaction & Hooks)
    expect(text).toContain('tx.user.update');
    expect(text).toContain("HookSystem.dispatch('user.updated'");

    // Fragment: Delete
    expect(text).toContain('tx.user.delete');
    expect(text).toContain("HookSystem.dispatch('user.deleted'");
  });

  it('should generate blocked delete method when disabled', () => {
    const builder = new ServiceBuilder(model, false);
    builder.ensure(sourceFile);

    const text = sourceFile.getFullText();
    expect(text).toContain('static async delete');
    expect(text).toContain('user.service.error.unsafe_delete_blocked');
    expect(text).not.toContain('tx.user.delete');
  });

  it('should preserve existing method bodies (Structural Match)', () => {
    const existingFile = project.createSourceFile(
      'ExistingService.ts',
      `
            export class UserService {
                static async list() {
                    console.log('custom logic');
                    return "custom list";
                }
            }
        `,
    );
    const builder = new ServiceBuilder(model);
    builder.ensure(existingFile);

    const text = existingFile.getFullText();
    // Should preserve the user's custom logic because it structurally matches a MethodDeclaration (even if body differs)
    expect(text).toContain("console.log('custom logic');");
    expect(text).toContain('return "custom list";');

    // Should NOT inject the generated list logic which contains db calls
    expect(text).not.toContain('db.user.findMany');
  });
});
