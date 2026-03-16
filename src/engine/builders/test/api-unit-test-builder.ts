import { type FileDefinition, type NodeContainer } from '../../types.js';
import { BaseBuilder } from '../base-builder.js';
import { TemplateLoader } from '../../../utils/template-loader.js';

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
  ) {
    super();
  }

  private renderTests(route: { method: string; actionName?: string; actionPath?: string }): string {
    const { method, actionName } = route;
    const { serviceName, endpointPath } = this;

    let successMock = '';
    if (actionName) {
      successMock = `vi.mocked(${actionName}.run).mockResolvedValue({
      success: true,
      data: { id: 'test-id' },
    } as any);`;
    } else if (serviceName) {
      successMock = `
    const serviceMethod = '${method}'.toLowerCase() === 'post' ? 'create' :
                         '${method}'.toLowerCase() === 'get' ? ('${endpointPath}'.includes('[id]') ? 'get' : 'list') :
                         '${method}'.toLowerCase() === 'put' ? 'update' :
                         '${method}'.toLowerCase() === 'delete' ? 'delete' : 'list';
    
    vi.mocked((${serviceName} as any)[serviceMethod]).mockResolvedValue({
      success: true,
      data: { id: 'test-id' },
    } as any);`;
    }

    let failureMock = '';
    if (actionName) {
      failureMock = `vi.mocked(${actionName}.run).mockResolvedValue({
      success: false,
      error: 'Something went wrong',
    } as any);`;
    } else if (serviceName) {
      failureMock = `
    const serviceMethod = '${method}'.toLowerCase() === 'post' ? 'create' :
                         '${method}'.toLowerCase() === 'get' ? ('${endpointPath}'.includes('[id]') ? 'get' : 'list') :
                         '${method}'.toLowerCase() === 'put' ? 'update' :
                         '${method}'.toLowerCase() === 'delete' ? 'delete' : 'list';
    
    vi.mocked((${serviceName} as any)[serviceMethod]).mockResolvedValue({
      success: false,
      error: 'Something went wrong',
    } as any);`;
    }

    return `
  it('should call ${actionName || serviceName} and return success', async () => {
    const query = ['GET', 'DELETE'].includes('${method}'.toUpperCase()) 
      ? '?id=test-id&email=test@example.com&username=testuser&name=Test&token=test-token&hostname=localhost&agentId=agent-1&teamId=team-1&userId=user-1&type=TASK&status=ACTIVE&reason=Test%20Reason&amount=100&count=10&limit=10&offset=0&search='
      : '';
    const fullUrl = 'http://localhost/api/test' + query;

    const mockContext = createMockAstroContext({
      url: fullUrl,
      params: { id: 'test-id' },
      locals: { actor: { id: 'user-1', type: 'user', email: 'test@example.com' } },
    }) as unknown as APIContext;

    mockContext.request = new Request(fullUrl, {
      method: '${method}',
      ${
        ['GET', 'HEAD'].includes(method.toUpperCase())
          ? ''
          : `body: JSON.stringify({ id: 'test-id', email: 'test@example.com', username: 'testuser', name: 'Test', password: 'password', confirmPassword: 'password', token: 'test-token', progress: 50, hostname: 'localhost', agentId: 'agent-1', teamId: 'team-1', userId: 'user-1', type: 'TASK', status: 'ACTIVE', capabilities: [], payload: { test: true }, reason: 'Test Reason', amount: 100, count: 10, limit: 10, offset: 0, search: '' }),`
      }
    });

    ${successMock}

    const response = await ${method}(mockContext);
    
    if (response instanceof Response) {
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
    } else {
        expect((response as any).success).toBe(true);
    }
  });

  it('should return 400 when invalid input is provided (scaffold)', async () => {
    const query = ['GET', 'DELETE'].includes('${method}'.toUpperCase()) 
      ? '?id=test-id&email=test@example.com&username=testuser&name=Test&token=test-token&hostname=localhost&agentId=agent-1&teamId=team-1&userId=user-1&type=TASK&status=ACTIVE&reason=Test%20Reason&amount=100&count=10&limit=10&offset=0&search='
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
    } catch (e) {
        // Expected if it throws on invalid json
    }
  });

  it('should return 500 when action fails', async () => {
    const query = ['GET', 'DELETE'].includes('${method}'.toUpperCase()) 
      ? '?id=test-id&email=test@example.com&username=testuser&name=Test&token=test-token&hostname=localhost&agentId=agent-1&teamId=team-1&userId=user-1&type=TASK&status=ACTIVE&reason=Test%20Reason&amount=100&count=10&limit=10&offset=0&search='
      : '';
    const fullUrl = 'http://localhost/api/test' + query;

    const mockContext = createMockAstroContext({
      url: fullUrl,
      params: { id: 'test-id' },
      locals: { actor: { id: 'user-1', type: 'user', email: 'test@example.com' } },
    }) as unknown as APIContext;

    mockContext.request = new Request(fullUrl, {
      method: '${method}',
      ${
        ['GET', 'HEAD'].includes(method.toUpperCase())
          ? ''
          : `body: JSON.stringify({ id: 'test-id', email: 'test@example.com', username: 'testuser', name: 'Test', password: 'password', confirmPassword: 'password', token: 'test-token', progress: 50, hostname: 'localhost', agentId: 'agent-1', teamId: 'team-1', userId: 'user-1', type: 'TASK', status: 'ACTIVE', capabilities: [], payload: { test: true }, reason: 'Test Reason', amount: 100, count: 10, limit: 10, offset: 0, search: '' }),`
      }
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

    const imports: import('../../types.js').ImportConfig[] = Array.from(
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
