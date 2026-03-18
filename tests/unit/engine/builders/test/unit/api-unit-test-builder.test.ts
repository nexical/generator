/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ApiUnitTestBuilder } from '@nexical/generator/engine/builders/test/unit/api-unit-test-builder.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';

vi.mock('@nexical/generator/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn(() => ({ raw: '// Mock content' })),
  },
}));

describe('ApiUnitTestBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate correct schema with actions', () => {
    const builder = new ApiUnitTestBuilder('test-api', 'User', '../endpoints/user', [
      { method: 'GET', actionName: 'ListUsers', actionPath: '../actions/list-users' },
      { method: 'POST', actionName: 'CreateUser', actionPath: '../actions/create-user' },
    ]);

    // ApiUnitTestBuilder.getSchema returns { header, imports, statements }
    // @ts-expect-error - getSchema is protected
    const schema = builder.getSchema();

    expect(schema.header).toBe('// GENERATED CODE - DO NOT MODIFY');
    expect(schema.statements).toHaveLength(5); // 2 mocks + 1 guard mock + 2 TemplateLoader.load results
    expect(schema.statements).toContain("vi.mock('../actions/list-users');");
    expect(schema.statements).toContain("vi.mock('../actions/create-user');");
    expect(schema.statements).toContain("vi.mock('@/lib/api/api-guard');");

    expect(TemplateLoader.load).toHaveBeenCalledWith(
      'test/unit/api.tsf',
      expect.objectContaining({
        modelName: 'User',
        method: 'GET',
      }),
    );
  });

  it('should generate correct schema with services and multiple methods', () => {
    const builder = new ApiUnitTestBuilder(
      'test-api',
      'User',
      '../endpoints/user/[id]', // Includes [id] to test branch for GET get/list
      [
        { method: 'GET' },
        { method: 'POST' },
        { method: 'PUT' },
        { method: 'DELETE' },
        { method: 'PATCH' },
      ],
      'UserService',
      '../services/user-service',
    );
    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();

    expect(_schema.statements).toContain("vi.mock('../services/user-service');");

    // Check renderTests via TemplateLoader.load calls
    const calls = vi.mocked(TemplateLoader.load).mock.calls;
    expect(calls).toHaveLength(5);

    const renderedTests = calls.map(
      (call) => (call[1] as Record<string, unknown>).renderedTests as string,
    );

    // GET with [id] -> serviceMethod should be 'get'
    expect(renderedTests[0]).toContain(
      "const serviceMethod = 'GET'.toLowerCase() === 'post' ? 'create' :",
    );
    expect(renderedTests[0]).toContain('const response = await GET(mockContext);');

    // POST -> serviceMethod should be 'create'
    expect(renderedTests[1]).toContain('const response = await POST(mockContext);');

    // PUT -> serviceMethod should be 'update'
    expect(renderedTests[2]).toContain('const response = await PUT(mockContext);');

    // DELETE -> serviceMethod should be 'delete'
    expect(renderedTests[3]).toContain('const response = await DELETE(mockContext);');

    // PATCH (default) -> serviceMethod should be 'list' (or whatever final fallback is)
    expect(renderedTests[4]).toContain('const response = await PATCH(mockContext);');
  });
});
