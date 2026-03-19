// GENERATED CODE - DO NOT MODIFY
import { ApiClient } from '@tests/integration/lib/client';
import { Factory } from '@tests/integration/lib/factory';
import { TestServer } from '@tests/integration/lib/server';
import { beforeEach, describe, expect, it } from 'vitest';
describe('TeamApi API - Get', () => {
  let client: ApiClient;

  beforeEach(async () => {
    client = new ApiClient(TestServer.getUrl());
  });

  // GET /api/team-api/[id]
  describe('GET /api/team-api/[id]', () => {
    it('should retrieve a specific teamApi', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const actor = await client.as('user', {});

      const target = await Factory.create('teamApi', { ...{} });

      const res = await client.get(`/api/team-api/${target.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(target.id);
    });

    it('should return 404 for missing id', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const actor = await client.as('user', {});
      const res = await client.get('/api/team-api/missing-id-123');
      expect(res.status).toBe(404);
    });
  });
});
