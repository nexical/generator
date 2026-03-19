// GENERATED CODE - DO NOT MODIFY
import type { ApiActor } from '@/lib/api/api-docs';
import { db } from '@/lib/core/db';
import { Logger } from '@/lib/core/logger';
import { HookSystem } from '@/lib/modules/hooks';
import type { ServiceResponse } from '@/types/service';
import { Prisma, TeamApi } from '@prisma/client';

/** Service class for TeamApi-related business logic. */
export class TeamApiService {
  public static async list(
    params?: Prisma.TeamApiFindManyArgs,
    actor?: ApiActor,
  ): Promise<ServiceResponse<TeamApi[]>> {
    try {
      let { where, take, skip, orderBy, select } = params || {};

      // Allow hooks to modify the query parameters (e.g. for scoping)
      // Pass actor context if available
      const filteredParams = await HookSystem.filter('teamApi.beforeList', {
        where,
        take,
        skip,
        orderBy,
        select,
        actor,
      });
      where = filteredParams.where;
      take = filteredParams.take;
      skip = filteredParams.skip;
      orderBy = filteredParams.orderBy;
      select = filteredParams.select;

      const [data, total] = await db.$transaction([
        db.teamApi.findMany({ where, take, skip, orderBy, select }),
        db.teamApi.count({ where }),
      ]);

      const filteredData = await HookSystem.filter('teamApi.list', data);

      return { success: true, data: filteredData, total };
    } catch (error) {
      Logger.error('TeamApi list Error', error);
      return { success: false, error: 'teamApi.service.error.list_failed' };
    }
  }

  public static async get(
    id: string,
    select?: Prisma.TeamApiSelect,
    actor?: ApiActor,
  ): Promise<ServiceResponse<TeamApi | null>> {
    try {
      const data = await db.teamApi.findUnique({ where: { id }, select });
      if (!data) return { success: false, error: 'teamApi.service.error.not_found' };

      const filtered = await HookSystem.filter('teamApi.read', data, { actor });

      return { success: true, data: filtered };
    } catch (error) {
      Logger.error('TeamApi get Error', error);
      return { success: false, error: 'teamApi.service.error.get_failed' };
    }
  }

  public static async create(
    data: Prisma.TeamApiCreateInput,
    select?: Prisma.TeamApiSelect,
    actor?: ApiActor,
  ): Promise<ServiceResponse<TeamApi>> {
    try {
      // Pass actor context to hooks for security/authorship validation
      const input = await HookSystem.filter('teamApi.beforeCreate', data, { actor });

      const newItem = await db.$transaction(async (tx) => {
        const created = await tx.teamApi.create({
          data: input as Prisma.TeamApiCreateInput,
          select,
        });
        await HookSystem.dispatch('teamApi.created', {
          id: created.id,
          actorId: actor?.id || 'system',
        });
        return created;
      });

      const filtered = await HookSystem.filter('teamApi.read', newItem, { actor });

      return { success: true, data: filtered };
    } catch (error) {
      Logger.error('TeamApi create Error', error);
      return { success: false, error: 'teamApi.service.error.create_failed' };
    }
  }

  public static async update(
    id: string,
    data: Prisma.TeamApiUpdateInput,
    select?: Prisma.TeamApiSelect,
    actor?: ApiActor,
  ): Promise<ServiceResponse<TeamApi>> {
    try {
      const input = await HookSystem.filter('teamApi.beforeUpdate', data, { actor, id });

      const updatedItem = await db.$transaction(async (tx) => {
        const updated = await tx.teamApi.update({
          where: { id },
          data: input as Prisma.TeamApiUpdateInput,
          select,
        });
        await HookSystem.dispatch('teamApi.updated', {
          id,
          changes: Object.keys(input),
          actorId: actor?.id,
        });
        return updated;
      });

      const filtered = await HookSystem.filter('teamApi.read', updatedItem, { actor });

      return { success: true, data: filtered };
    } catch (error) {
      Logger.error('TeamApi update Error', error);
      return { success: false, error: 'teamApi.service.error.update_failed' };
    }
  }

  public static async delete(id: string, actor?: ApiActor): Promise<ServiceResponse<void>> {
    try {
      await db.$transaction(async (tx) => {
        await tx.teamApi.delete({ where: { id } });
        await HookSystem.dispatch('teamApi.deleted', { id, actorId: actor?.id });
      });
      return { success: true };
    } catch (error) {
      Logger.error('TeamApi delete Error', error);
      return { success: false, error: 'teamApi.service.error.delete_failed' };
    }
  }
}
