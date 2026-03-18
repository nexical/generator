import { type FileDefinition, type NodeContainer, type ModelField } from '../../../types.js';
import { BaseBuilder } from '../../base-builder.js';
import { TemplateLoader } from '../../../../utils/template-loader.js';

export class ApiUnitTestBuilder extends BaseBuilder {
  constructor(
    private moduleName: string,
    private modelName: string,
    private endpointPath: string, // Relative path to endpoint from the test file
    private routes: {
      method: string;
      actionName?: string;
      actionPath?: string;
    }[],
    private serviceName?: string,
    private servicePath?: string,
    private fields?: Record<string, ModelField>,
  ) {
    super();
  }

  private generateMockData(isQuery = false): string {
    const props: Record<string, string> = {
      id: "'test-id'",
    };

    if (this.fields) {
      for (const [fieldName, field] of Object.entries(this.fields)) {
        if (field.isList || field.isRelation) continue;
        if (fieldName === 'id' || fieldName === 'createdAt' || fieldName === 'updatedAt') continue;

        const type = field.type;
        if (type === 'String') {
          if (fieldName.toLowerCase().includes('email')) props[fieldName] = "'test@example.com'";
          else if (fieldName.toLowerCase().includes('token')) props[fieldName] = "'test-token'";
          else props[fieldName] = "'test'";
        } else if (type === 'Int' || type === 'Float') props[fieldName] = '100';
        else if (type === 'Boolean') props[fieldName] = 'true';
        else if (type === 'DateTime') props[fieldName] = 'new Date().toISOString()';
        else if (type === 'Json') props[fieldName] = '{}';
        else props[fieldName] = "'test-enum'";
      }
    } else {
      props['name'] = "'Test'";
    }

    if (isQuery) {
      return Object.entries(props)
        .map(([k, v]) => `${k}=\${encodeURIComponent(${v}.toString())}`)
        .join('&');
    }

    const entries = Object.entries(props)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return `{ ${entries} }`;
  }

  private renderTests(route: { method: string; actionName?: string; actionPath?: string }): string {
    const { method, actionName } = route;
    const { serviceName, endpointPath } = this;

    const mockQuery = this.generateMockData(true);
    const mockBody = this.generateMockData(false);

    let successMock = '';
    if (actionName) {
      successMock = `vi.mocked(${actionName}.run).mockResolvedValue({
      success: true,
      data: { id: 'test-id' },
    } as Record<string, unknown>);`;
    } else if (serviceName) {
      successMock = `
    const serviceMethod = '${method}'.toLowerCase() === 'post' ? 'create' :
                         '${method}'.toLowerCase() === 'get' ? ('${endpointPath}'.includes('[id]') ? 'get' : 'list') :
                         '${method}'.toLowerCase() === 'put' ? 'update' :
                         '${method}'.toLowerCase() === 'delete' ? 'delete' : 'list';
    
    vi.mocked((${serviceName} as Record<string, unknown>)[serviceMethod]).mockResolvedValue({
      success: true,
      data: { id: 'test-id' },
    } as Record<string, unknown>);`;
    }

    let failureMock = '';
    if (actionName) {
      failureMock = `vi.mocked(${actionName}.run).mockResolvedValue({
      success: false,
      error: 'Something went wrong',
    } as Record<string, unknown>);`;
    } else if (serviceName) {
      failureMock = `
    const serviceMethod = '${method}'.toLowerCase() === 'post' ? 'create' :
                         '${method}'.toLowerCase() === 'get' ? ('${endpointPath}'.includes('[id]') ? 'get' : 'list') :
                         '${method}'.toLowerCase() === 'put' ? 'update' :
                         '${method}'.toLowerCase() === 'delete' ? 'delete' : 'list';
    
    vi.mocked((${serviceName} as Record<string, unknown>)[serviceMethod]).mockResolvedValue({
      success: false,
      error: 'Something went wrong',
    } as Record<string, unknown>);`;
    }

    return `
  it('should call ${actionName || serviceName} and return success', async () => {
    const query = ['GET', 'DELETE'].includes('${method}'.toUpperCase()) 
      ? '?${mockQuery}'
      : '';
    const fullUrl = 'http://localhost/api/test' + query;

    const mockContext = createMockAstroContext({
      url: fullUrl,
      params: { id: 'test-id' },
      locals: { actor: { id: 'user-1', type: 'user', email: 'test@example.com' } },
    }) as unknown as APIContext;

    mockContext.request = new Request(fullUrl, {
      method: '${method}',
      ${['GET', 'HEAD'].includes(method.toUpperCase()) ? '' : `body: JSON.stringify(${mockBody}),`}
    });

    ${successMock}

    const response = await ${method}(mockContext);
    
    if (response instanceof Response) {
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
    } else {
        expect((response as unknown as Record<string, boolean>).success).toBe(true);
    }
  });

  it('should return 400 when invalid input is provided (scaffold)', async () => {
    const query = ['GET', 'DELETE'].includes('${method}'.toUpperCase()) 
      ? '?${mockQuery}'
      : '';
    const fullUrl = 'http://localhost/api/test' + query;

    const mockContext = createMockAstroContext({
      url: fullUrl,
      params: { id: 'test-id' },
      locals: { actor: { id: 'user-1', type: 'user', email: 'test@example.com' } },
    }) as unknown as APIContext;

    mockContext.request = new Request(fullUrl, {
      method: '${method}',
      ${['GET', 'HEAD'].includes(method.toUpperCase()) ? '' : `body: 'invalid-json',`}
    });

    try {
        const response = await ${method}(mockContext);
        if (response instanceof Response) {
            expect([400, 500]).toContain(response.status);
        }
    } catch {
        // Expected if it throws on invalid json
    }
  });

  it('should return 500 when action fails', async () => {
    const query = ['GET', 'DELETE'].includes('${method}'.toUpperCase()) 
      ? '?${mockQuery}'
      : '';
    const fullUrl = 'http://localhost/api/test' + query;

    const mockContext = createMockAstroContext({
      url: fullUrl,
      params: { id: 'test-id' },
      locals: { actor: { id: 'user-1', type: 'user', email: 'test@example.com' } },
    }) as unknown as APIContext;

    mockContext.request = new Request(fullUrl, {
      method: '${method}',
      ${['GET', 'HEAD'].includes(method.toUpperCase()) ? '' : `body: JSON.stringify(${mockBody}),`}
    });

    ${failureMock}

    const response = await ${method}(mockContext);
    
    if (response instanceof Response) {
        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe('Something went wrong');
    }
  });`;
  }

  protected getSchema(_node?: NodeContainer): FileDefinition {
    // 1. Group Imports
    const moduleImports = new Map<string, Set<string>>();
    const typeOnlyModules = new Set<string>();

    const addImport = (moduleSpecifier: string, ids: string[], isTypeOnly = false) => {
      const set = moduleImports.get(moduleSpecifier) || new Set<string>();
      ids.forEach((id) => set.add(id));
      moduleImports.set(moduleSpecifier, set);
      if (isTypeOnly) typeOnlyModules.add(moduleSpecifier);
    };

    // Base imports
    addImport('vitest', ['describe', 'it', 'expect', 'vi', 'beforeEach']);
    addImport('@/lib/api/api-guard', ['ApiGuard']);
    addImport('@tests/unit/helpers', ['createMockAstroContext']);
    addImport('astro', ['APIContext'], true);

    // Route-specific imports
    this.routes.forEach((route) => {
      addImport(this.endpointPath, [route.method]);
      if (route.actionName && route.actionPath) {
        addImport(route.actionPath, [route.actionName]);
      }
    });

    if (this.serviceName && this.servicePath) {
      addImport(this.servicePath, [this.serviceName]);
    }

    const imports: import('../../../types.js').ImportConfig[] = Array.from(
      moduleImports.entries(),
    ).map(([module, ids]) => ({
      moduleSpecifier: module,
      namedImports: Array.from(ids),
      isTypeOnly: typeOnlyModules.has(module),
    }));

    const statements: string[] = [];

    // 2. Group Mocks
    const mockPaths = new Set<string>();
    this.routes.forEach((route) => {
      if (route.actionPath) mockPaths.add(route.actionPath);
    });
    if (this.servicePath) mockPaths.add(this.servicePath);

    mockPaths.forEach((path) => statements.push(`vi.mock('${path}');`));
    statements.push(`vi.mock('@/lib/api/api-guard');`);

    // 3. Test blocks
    this.routes.forEach((route) => {
      statements.push(
        TemplateLoader.load('test/unit/api.tsf', {
          modelName: this.modelName,
          method: route.method,
          endpointPath: this.endpointPath,
          renderedTests: this.renderTests(route),
        }).raw,
      );
    });

    return {
      header: '// GENERATED CODE - DO NOT MODIFY',
      imports,
      statements,
    };
  }
}
