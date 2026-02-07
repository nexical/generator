/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { FactoryBuilder } from '../../../../src/engine/builders/factory-builder';
import { type ModelDef } from '../../../../src/engine/types';

describe('FactoryBuilder', () => {
  it('should generate factories for models', () => {
    const models: ModelDef[] = [
      {
        name: 'User',
        db: true,
        api: true,
        fields: {
          id: {
            type: 'Int',
            isRequired: true,
            isList: false,
            api: true,
            attributes: ['@id', '@default(autoincrement())'],
          },
          email: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
          role: { type: 'SiteRole', isRequired: true, isList: false, api: true, attributes: [] },
        },
      },
    ];

    const builder = new FactoryBuilder(models);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);

    const factoriesVar = sourceFile.getVariableStatement('factories');
    expect(factoriesVar).toBeDefined();
    const initText = factoriesVar?.getDeclarations()[0].getInitializer()?.getText();
    expect(initText).toContain('user: (index: number) => {');
    expect(initText).toContain('email:');
    expect(initText).toContain("'EMPLOYEE'"); // Enum fallback
  });

  it('should handle relations and special fields', () => {
    const models: ModelDef[] = [
      {
        name: 'Team',
        db: true,
        api: true,
        fields: {
          id: { type: 'Int', isRequired: true, isList: false, api: true, attributes: ['@id'] },
          name: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
        },
      },
      {
        name: 'User',
        db: true,
        api: true,
        fields: {
          id: { type: 'Int', isRequired: true, isList: false, api: true, attributes: ['@id'] },
          username: {
            type: 'String',
            isRequired: true,
            isList: false,
            api: true,
            attributes: ['@unique'],
          },
          token: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
          teamId: { type: 'Int', isRequired: true, isList: false, api: true, attributes: [] },
          team: {
            type: 'Team',
            isRequired: true,
            isRelation: true,
            isList: false,
            api: true,
            attributes: ['@relation(fields: [teamId], references: [id])'],
          },
        },
      },
    ];

    const builder = new FactoryBuilder(models);
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test_complex.ts', '');

    builder.ensure(sourceFile);

    const initText = sourceFile
      .getVariableStatement('factories')
      ?.getDeclarations()[0]
      .getInitializer()
      ?.getText();
    expect(initText).toContain(
      "username: `username_${index}_${crypto.randomUUID().split('-')[0]}`",
    );
    expect(initText).toContain("token: `token_${index}_${crypto.randomUUID().split('-')[0]}`");
    // Check nested factory for relation
    expect(initText).toContain('team: {');
    expect(initText).toContain("create: Factory.getBuilder('team')(index)");
  });
});
