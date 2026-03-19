// GENERATED CODE - DO NOT MODIFY
import { ApiClient, BaseResource } from '@nexical/sdk-core';
import { TeamApiSDK as BaseTeamApiSDK } from './team-api-sdk.js';

/** Main SDK for the team-api module. */
export class TeamModule extends BaseResource {
  public teamApi: BaseTeamApiSDK;
  public static readonly roles: Record<string, string> = {};

  constructor(client: ApiClient) {
    super(client);
    this.teamApi = new BaseTeamApiSDK(client);
  }
}

export * from './team-api-sdk.js';
export * from './types.js';
