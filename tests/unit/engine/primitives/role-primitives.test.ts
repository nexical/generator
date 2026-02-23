import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { FrontendRolePrimitive } from '../../../../src/engine/primitives/nodes/frontend-role.js';
import { RolePrimitive } from '../../../../src/engine/primitives/nodes/role.js';

describe('Role Primitives Coverage', () => {
  it('frontend-role: should gracefully handle missing description', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile('test-frontend.ts', '');

    const prim = new FrontendRolePrimitive({
      name: 'MODERATOR',
      definition: {},
    });

    prim.ensure(sf);
    expect(sf.getText()).toContain('ModeratorRole');

    // Find existing to cover the find method
    expect(prim.find(sf)).toBeDefined();
    // Validation trivially returns true
    expect(prim.validate({}).valid).toBe(true);
  });

  it('role: should gracefully handle missing definition attributes (description, inherits, permissions)', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile('test-backend.ts', '');

    const prim = new RolePrimitive({
      name: 'GUEST',
      definition: {},
    });

    prim.ensure(sf);
    expect(sf.getText()).toContain('GuestRole');

    // Find existing to cover the find method
    expect(prim.find(sf)).toBeDefined();
    expect(prim.validate({}).valid).toBe(true);
  });
});
