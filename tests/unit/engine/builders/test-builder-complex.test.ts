/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { TestBuilder } from '../../../../src/engine/builders/test-builder';
import { type ModelDef } from '../../../../src/engine/types';

describe('TestBuilder Complex Scenarios', () => {
  // Scenario 1: Model with complex fields (DateTime, List, Json) and Reserved fields
  const complexModel: ModelDef = {
    name: 'ComplexDoc',
    db: true,
    api: true,
    fields: {
      id: { type: 'String', isRequired: true, isList: false, api: true, attributes: ['@id'] },
      createdAt: { type: 'DateTime', isRequired: true, isList: false, api: true, attributes: [] }, // Should skip in payload
      name: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      tags: { type: 'String', isRequired: true, isList: true, api: true, attributes: [] },
      meta: { type: 'Json', isRequired: true, isList: false, api: true, attributes: [] },
      scheduledAt: { type: 'DateTime', isRequired: true, isList: false, api: true, attributes: [] },
      status: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] }, // Reserved field
    },
    test: { actor: 'User' },
  };

  // Scenario 2: Model with deep relations and custom FKs
  const relationModel: ModelDef = {
    name: 'Ticket',
    db: true,
    fields: {
      id: { type: 'Int', isRequired: true, isList: false, api: true, attributes: ['@id'] },
      title: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      // Required FK - should trigger dependency setup
      categoryId: { type: 'Int', isRequired: true, isList: false, api: true, attributes: [] },
      category: {
        type: 'Category',
        isRequired: true,
        isList: false,
        api: false,
        isRelation: true,
        attributes: ['@relation(fields: [categoryId])'],
      },
      // Actor relation via custom field
      assigneeId: { type: 'Int', isRequired: false, isList: false, api: true, attributes: [] },
      assignee: {
        type: 'User',
        isRequired: false,
        isList: false,
        api: false,
        isRelation: true,
        attributes: ['@relation(fields: [assigneeId])'],
      },
    },
    api: true,
    test: { actor: 'User' },
  };

  it('should handle update logic with complex and reserved fields', () => {
    const builder = new TestBuilder(complexModel, 'ComplexDocApi', 'update');
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);
    const text = sourceFile.getText();

    // Should include scheduledAt and tags in payload
    expect(text).toContain('scheduledAt: new Date().toISOString()');
    expect(text).toContain('"tags_updated"');

    // Should NOT include reserved fields in update payload
    expect(text).not.toContain('status: "status_updated"');
    expect(text).not.toContain('createdAt:');

    // Should verify DateTime handling in assertions
    expect(text).toContain(
      'expect(updated?.scheduledAt.toISOString()).toBe(updatePayload.scheduledAt)',
    );
  });

  it('should generate dependency setup for required Foreign Keys', () => {
    const builder = new TestBuilder(relationModel, 'TicketApi', 'create');
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);
    const text = sourceFile.getText();

    // Should create category dependency
    expect(text).toContain("Factory.create('category'");

    // Should inject fk into payload
    expect(text).toContain('categoryId: category_0.id');
  });

  it('should identify actor relation via foreign key attribute', () => {
    // We modify the model slightly to make assignee required to force testing the logic
    const strictModel = JSON.parse(JSON.stringify(relationModel));
    strictModel.fields['assigneeId'].isRequired = true;

    const builder = new TestBuilder(strictModel, 'TicketApi', 'create');
    // We need to inject the logic that finds 'assigneeId' as the actor field.
    // The builder logic 'getActorRelationFieldName' checks for type match.
    // 'assignee' has type 'User'. Actor is 'User'. Match!

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);
    const text = sourceFile.getText();

    // Should see actor injection
    expect(text).toContain('assigneeId: (actor ? (actor as any).id : undefined)');
  });

  it('should handle list filtering unique injection', () => {
    const uniqueModel: ModelDef = {
      name: 'Profile',
      db: true,
      fields: {
        id: { type: 'Int', isRequired: true, isList: false, api: true, attributes: ['@id'] },
        email: {
          type: 'String',
          isRequired: true,
          isList: false,
          api: true,
          attributes: ['@unique'],
        },
        bio: { type: 'String', isRequired: true, isList: false, api: true, attributes: [] },
      },
      api: true,
      test: { actor: 'User' },
    };

    const builder = new TestBuilder(uniqueModel, 'ProfileApi', 'list');
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts', '');

    builder.ensure(sourceFile);
    const text = sourceFile.getText();

    // Should inject unique email for list items to avoid collision
    expect(text).toContain(", email: 'filter_a_' + Date.now() + '@example.com'");
    expect(text).toContain(", email: 'filter_b_' + Date.now() + '@example.com'");
  });
});
