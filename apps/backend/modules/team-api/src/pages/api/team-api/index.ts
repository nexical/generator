// GENERATED CODE - DO NOT MODIFY
import { defineApi } from '@/lib/api/api-docs';
import { ApiGuard } from '@/lib/api/api-guard';
import { parseQuery } from '@/lib/api/api-query';
import { HookSystem } from '@/lib/modules/hooks';
import { TeamApiService } from '@modules/team-api/src/services/team-api-service';
import { z } from 'zod';

export const GET = defineApi(
  async (context, actor) => {
    const filterOptions = {
      fields: {
        id: 'string',
        name: 'string',
        createdAt: 'date',
        updatedAt: 'date',
      },
      searchFields: ['id', 'name'],
    } as const;

    const { where, take, skip, orderBy } = parseQuery(
      new URL(context.request.url).searchParams,
      filterOptions,
    );

    // Security Check
    // Pass query params as input to role check
    await ApiGuard.protect(context, 'USER_EMPLOYEE', {
      ...context.params,
      where,
      take,
      skip,
      orderBy,
    });

    const select = {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    };
    const result = await TeamApiService.list({ where, take, skip, orderBy, select }, actor);

    if (!result.success) {
      throw new Error(result.error || 'Internal Server Error');
    }

    const data = result.data || [];
    const total = result.total || 0;

    // Analytics Hook
    await HookSystem.dispatch('teamApi.list.viewed', {
      count: data.length,
      actorId: actor?.id || 'anonymous',
    });

    return { success: true, data, meta: { total } };
  },
  {
    summary: 'List TeamApis',
    tags: ['TeamApi'],
    parameters: [
      { name: 'take', in: 'query', schema: { type: 'integer' } },
      { name: 'skip', in: 'query', schema: { type: 'integer' } },
      { name: 'search', in: 'query', schema: { type: 'string' } },
      {
        name: 'orderBy',
        in: 'query',
        schema: { type: 'string' },
        description: 'Ordering (format: field:asc or field:desc)',
      },
      {
        name: 'id.eq',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by id (eq)',
      },
      {
        name: 'id.ne',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by id (ne)',
      },
      {
        name: 'id.contains',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by id (contains)',
      },
      {
        name: 'id.startsWith',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by id (startsWith)',
      },
      {
        name: 'id.endsWith',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by id (endsWith)',
      },
      {
        name: 'id.in',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by id (in)',
      },
      {
        name: 'id',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by id (eq)',
      },
      {
        name: 'name.eq',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by name (eq)',
      },
      {
        name: 'name.ne',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by name (ne)',
      },
      {
        name: 'name.contains',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by name (contains)',
      },
      {
        name: 'name.startsWith',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by name (startsWith)',
      },
      {
        name: 'name.endsWith',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by name (endsWith)',
      },
      {
        name: 'name.in',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by name (in)',
      },
      {
        name: 'name',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by name (eq)',
      },
      {
        name: 'createdAt.eq',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by createdAt (eq)',
      },
      {
        name: 'createdAt.ne',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by createdAt (ne)',
      },
      {
        name: 'createdAt.gt',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by createdAt (gt)',
      },
      {
        name: 'createdAt.gte',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by createdAt (gte)',
      },
      {
        name: 'createdAt.lt',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by createdAt (lt)',
      },
      {
        name: 'createdAt.lte',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by createdAt (lte)',
      },
      {
        name: 'createdAt.in',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by createdAt (in)',
      },
      {
        name: 'createdAt',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by createdAt (eq)',
      },
      {
        name: 'updatedAt.eq',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by updatedAt (eq)',
      },
      {
        name: 'updatedAt.ne',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by updatedAt (ne)',
      },
      {
        name: 'updatedAt.gt',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by updatedAt (gt)',
      },
      {
        name: 'updatedAt.gte',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by updatedAt (gte)',
      },
      {
        name: 'updatedAt.lt',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by updatedAt (lt)',
      },
      {
        name: 'updatedAt.lte',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by updatedAt (lte)',
      },
      {
        name: 'updatedAt.in',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by updatedAt (in)',
      },
      {
        name: 'updatedAt',
        in: 'query',
        schema: { type: 'string' },
        required: false,
        description: 'Filter by updatedAt (eq)',
      },
    ],

    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                    required: ['updatedAt'],
                  },
                },
                meta: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
);
export const POST = defineApi(
  async (context, actor) => {
    const body = await context.request.json();

    // Security Check
    await ApiGuard.protect(context, 'USER_EMPLOYEE', { ...context.params, ...body });

    // Zod Validation
    const schema = z.object({
      id: z.string().optional(),
      name: z.string().optional(),
    });
    const validated = schema.parse(body);
    const select = {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    };
    const result = await TeamApiService.create(validated, select, actor);

    if (!result.success) {
      throw new Error(result.error || 'Internal Server Error');
    }

    return new Response(JSON.stringify({ success: true, data: result.data }), { status: 201 });
  },
  {
    summary: 'Create TeamApi',
    tags: ['TeamApi'],
    requestBody: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
            required: ['updatedAt'],
          },
        },
      },
    },
    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                  required: ['updatedAt'],
                },
              },
            },
          },
        },
      },
    },
  },
);
