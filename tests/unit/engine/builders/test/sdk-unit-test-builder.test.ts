/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SdkUnitTestBuilder } from '@nexical/generator/engine/builders/test/sdk-unit-test-builder.js';
import { TemplateLoader } from '@nexical/generator/utils/template-loader.js';

vi.mock('@nexical/generator/utils/template-loader.js', () => ({
  TemplateLoader: {
    load: vi.fn((_name, _data) => `// Mock content for ${_name}`),
  },
}));

interface SdkTemplateData {
  sdkName: string;
  sdkPath: string;
  tests: string;
}

describe('SdkUnitTestBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate correct schema with custom routes and CRUD', () => {
    const builder = new SdkUnitTestBuilder('UserSdk', '../sdk/user-sdk', 'User', [
      { method: 'customMethod', verb: 'POST', path: '/custom' },
    ]);

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();

    expect(_schema.header).toBe('// GENERATED CODE - DO NOT MODIFY');
    expect(_schema.statements).toHaveLength(1); // One TemplateLoader.load call

    expect(TemplateLoader.load).toHaveBeenCalledWith(
      'test/unit/sdk.tsf',
      expect.objectContaining({
        sdkName: 'UserSdk',
        sdkPath: '../sdk/user-sdk',
      }),
    );

    const tests = (vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as SdkTemplateData)
      .tests;
    expect(tests).toContain("it('should call GET /user on list()', async () => {");
    expect(tests).toContain("it('should call POST /custom on customMethod()', async () => {");
  });

  it('should handle no CRUD and fallback values for route properties', () => {
    const builder = new SdkUnitTestBuilder(
      'UserSdk',
      '../sdk/user-sdk',
      'User',
      [
        { method: 'minimal', verb: 'POST', path: '' }, // Missing verb and path defaults
      ],
      false, // hasCrud: false
    );

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const tests = (vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as SdkTemplateData)
      .tests;

    expect(tests).not.toContain("it('should call GET /user on list()', async () => {");
    expect(tests).toContain("it('should call POST  on minimal()', async () => {"); // POST is default verb, empty string is default path
  });

  it('should handle overlapping routes', () => {
    const builder = new SdkUnitTestBuilder(
      'UserSdk',
      '../sdk/user-sdk',
      'User',
      [{ method: 'list', verb: 'GET', path: '/custom-list' }],
      true,
    );

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const tests = (vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as SdkTemplateData)
      .tests;

    expect(tests).toContain("it('should call GET /custom-list on list()', async () => {");
    // Should not contain the standard list test
    expect(tests).not.toContain("it('should call GET /user on list()', async () => {");
  });

  it('should filter routes based on discoveredMethods', () => {
    const builder = new SdkUnitTestBuilder(
      'UserSdk',
      '../sdk/user-sdk',
      'User',
      [],
      true,
      { list: 1 }, // Only 'list' was discovered
    );

    // @ts-expect-error - getSchema is protected
    const _schema = builder.getSchema();
    const tests = (vi.mocked(TemplateLoader.load).mock.calls[0][1] as unknown as SdkTemplateData)
      .tests;

    expect(tests).toContain("it('should call GET /user on list()', async () => {");
    expect(tests).not.toContain("it('should call GET /user/[id] on get()', async () => {");
  });
});
