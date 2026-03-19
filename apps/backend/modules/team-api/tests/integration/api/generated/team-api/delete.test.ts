// GENERATED CODE - DO NOT MODIFY
import { ApiClient } from '@tests/integration/lib/client';
import { Factory } from '@tests/integration/lib/factory';
import { TestServer } from '@tests/integration/lib/server';
import { beforeEach, describe, expect, it } from 'vitest';
describe('TeamApi API - Delete', () => {
  let client: ApiClient;

  beforeEach(async () => {
    client = new ApiClient(TestServer.getUrl());
  });

  // DELETE /api/team-api/[id]
  describe('DELETE /api/team-api/[id]', () => {
    it('should delete teamApi', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const actor = await client.as('user', {});

      const target = await Factory.create('teamApi', { ...{} });

      const res = await client.delete(`/api/team-api/${target.id}`);

      expect(res.status).toBe(200);

      const check = await Factory.prisma.teamApi.findUnique({ where: { id: target.id } });
      expect(check).toBeNull();
    });
  });
});
