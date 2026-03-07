import { BaseCommand } from '@nexical/cli-core';
import fs from 'node:fs';
import path from 'node:path';

const MODELS_TEMPLATE = `models:
  # Define your data models here
  # Example:
  # User:
  #   fields:
  #     email:
  #       type: String
  #       attributes: ["@unique"]
`;

const API_TEMPLATE = `routes:
  # Define custom API routes here
  # Example:
  # User:
  #   - path: /me
  #     method: getMe
  #     verb: GET
  #     input: none
  #     output: User
`;

const ACCESS_TEMPLATE = `roles:
  member:
    description: "Standard authenticated user"
    permissions: []
  admin:
    description: "System administrator"
    permissions: ["*"]
`;

const UI_TEMPLATE = `backend: 
# Link to a backend module name (e.g., user-api)
# backend: my-api
`;

export async function specInitModule(
  command: BaseCommand,
  modulePath: string,
  options: { type: 'api' | 'ui' | 'agent' },
) {
  if (!fs.existsSync(modulePath)) {
    command.error(`Path does not exist: ${modulePath}`);
    return;
  }

  const type = options.type;

  if (type === 'api') {
    await initFile(command, modulePath, 'models.yaml', MODELS_TEMPLATE);
    await initFile(command, modulePath, 'api.yaml', API_TEMPLATE);
    await initFile(command, modulePath, 'access.yaml', ACCESS_TEMPLATE);
  } else if (type === 'ui') {
    await initFile(command, modulePath, 'ui.yaml', UI_TEMPLATE);
  } else if (type === 'agent') {
    await initFile(command, modulePath, 'agent.yaml', 'agents: []');
  }

  command.success(`Successfully initialized spec files in ${modulePath}`);
}

async function initFile(command: BaseCommand, dir: string, filename: string, content: string) {
  const filePath = path.join(dir, filename);
  if (fs.existsSync(filePath)) {
    command.error(`File already exists: ${filename}. Skipping.`);
    return;
  }
  fs.writeFileSync(filePath, content);
  command.info(`Created ${filename}`);
}
