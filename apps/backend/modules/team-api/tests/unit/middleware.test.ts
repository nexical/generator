// GENERATED CODE - DO NOT MODIFY
import type { APIContext } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../src/middleware';

vi.mock('@/lib/core/db', () => {
  const mockModelProps = { id: '1', status: 'ACTIVE', email: 'test@example.com' };
  const mockModel = {
    findUnique: vi.fn().mockResolvedValue(mockModelProps),
    findFirst: vi.fn().mockResolvedValue(mockModelProps),
    update: vi.fn().mockResolvedValue(mockModelProps),
  };
  return {
    db: new Proxy(
      {},
      {
        get: (target: Record<string, unknown>, prop: string): unknown => {
          if (typeof prop === 'string' && !prop.startsWith('$')) {
            return mockModel;
          }
          return target[prop];
        },
      },
    ),
  };
});

describe('Middleware: team-api', () => {
  let mockContext: Record<string, unknown>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn().mockResolvedValue(new Response());
    mockContext = {
      url: new URL('http://localhost/api/test'),
      request: {
        headers: new Headers(),
      },
      locals: {
        session: {
          get: vi.fn(),
        },
      },

      cookies: {
        get: vi.fn(),
      },
    };
  });

  it('should be defined', () => {
    expect(onRequest).toBeDefined();
  });

  it('should call next() for public routes', async () => {
    mockContext.url = new URL('http://localhost/api/health');
    await onRequest(
      mockContext as unknown as APIContext,
      mockNext as unknown as (context: APIContext) => Promise<Response>,
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should proceed even if unauthorized (Bouncer logic)', async () => {
    mockContext.request.headers.set('Authorization', 'Bearer invalid');
    await onRequest(
      mockContext as unknown as APIContext,
      mockNext as unknown as (context: APIContext) => Promise<Response>,
    );
    expect(mockNext).toHaveBeenCalled();
  });
});
