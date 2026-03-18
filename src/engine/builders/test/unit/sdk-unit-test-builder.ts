import { type FileDefinition, type NodeContainer } from '../../../types.js';
import { BaseBuilder } from '../../base-builder.js';
import { TemplateLoader } from '../../../../utils/template-loader.js';
import { toKebabCase } from '../../../../utils/string.js';

export class SdkUnitTestBuilder extends BaseBuilder {
  constructor(
    private sdkName: string,
    private sdkPath: string, // Relative path from test to sdk
    private entityName: string,
    private routes: import('../../../types.js').CustomRoute[] = [],
    private hasCrud: boolean = true,
    private discoveredMethods: Record<string, number> = {},
  ) {
    super();
  }

  private renderTests(): string {
    const kebabEntity = toKebabCase(this.entityName);
    const standardRoutes = this.hasCrud
      ? [
          { method: 'list', verb: 'GET' as const, path: `/${kebabEntity}` },
          { method: 'get', verb: 'GET' as const, path: `/${kebabEntity}/[id]` },
          { method: 'create', verb: 'POST' as const, path: `/${kebabEntity}` },
          { method: 'update', verb: 'PUT' as const, path: `/${kebabEntity}/[id]` },
          { method: 'delete', verb: 'DELETE' as const, path: `/${kebabEntity}/[id]` },
        ]
      : [];

    // Merge custom routes with standard ones, preferring custom if method names overlap
    const allRoutes = [...this.routes];
    standardRoutes.forEach((std) => {
      if (!allRoutes.find((r) => r.method === std.method)) {
        allRoutes.push(std);
      }
    });

    const discoveredMethodNames = Object.keys(this.discoveredMethods);
    const finalRoutes =
      discoveredMethodNames.length > 0
        ? allRoutes.filter((r) => discoveredMethodNames.includes(r.method))
        : allRoutes;

    return finalRoutes
      .map((route: import('../../../types.js').CustomRoute) => {
        const verb = route.verb ? route.verb.toUpperCase() : 'POST';
        const methodName = route.method;
        const path = route.path || '';

        return `
  it('should call ${verb} ${path} on ${methodName}()', async () => {
    mockClient.request.mockResolvedValue({ success: true, data: {} });
    
    const args: unknown[] = [];
    const pathParams = (('${path}').match(/\\[(\\w+)\\]/g) || []);
    pathParams.forEach(() => args.push('test-id'));
    
    if (['POST', 'PUT', 'PATCH'].includes('${verb}')) {
      args.push({ name: 'test' } as Record<string, unknown>);
    }
    
    await (sdk as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>).${methodName}(...args);
    
    expect(mockClient.request).toHaveBeenCalled();
    const [callVerb, callPath] = mockClient.request.mock.calls[0];
    expect(callVerb).toBe('${verb}');
    
    let expectedPath = '${path.replace(/^\//, '')}';
    pathParams.forEach(p => {
       expectedPath = expectedPath.replace(p, 'test-id');
    });
    expect(callPath).toContain(expectedPath);
  });

  it('should handle failure on ${methodName}()', async () => {
    mockClient.request.mockResolvedValue({ success: false, error: 'API Error' });
    
    const args: unknown[] = [];
    const pathParams = (('${path}').match(/\\[(\\w+)\\]/g) || []);
    pathParams.forEach(() => args.push('test-id'));
    
    if (['POST', 'PUT', 'PATCH'].includes('${verb}')) {
      args.push({ name: 'test' } as Record<string, unknown>);
    }
    
    const result = await (sdk as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>).${methodName}(...args);
    expect(result.success).toBe(false);
    expect(result.error).toBe('API Error');
  });`;
      })
      .join('\n');
  }

  protected getSchema(_node?: NodeContainer): FileDefinition {
    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      statements: [
        TemplateLoader.load('test/unit/sdk.tsf', {
          sdkName: this.sdkName,
          sdkPath: this.sdkPath,
          tests: this.renderTests(),
        }),
      ],
    };
  }
}
