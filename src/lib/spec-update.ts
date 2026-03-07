import { BaseCommand } from '@nexical/cli-core';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

interface RouteSpec {
  path: string;
  method: string;
  verb: string;
  input: string;
  output: string;
}

export async function specUpdateModule(
  command: BaseCommand,
  modulePath: string,
  options: { add?: string; route?: string },
) {
  if (!fs.existsSync(modulePath)) {
    command.error(`Path does not exist: ${modulePath}`);
    return;
  }

  const modelsYamlPath = path.join(modulePath, 'models.yaml');
  const apiYamlPath = path.join(modulePath, 'api.yaml');

  if (options.add) {
    const modelName = options.add;
    if (!fs.existsSync(modelsYamlPath)) {
      fs.writeFileSync(modelsYamlPath, `models:\n`);
    }

    const content = fs.readFileSync(modelsYamlPath, 'utf-8');
    const parsed = YAML.parse(content) || { models: {} };
    if (!parsed.models) parsed.models = {};

    if (!parsed.models[modelName]) {
      parsed.models[modelName] = {
        fields: {
          id: { type: 'String', attributes: ['@id', '@default(cuid())'] },
          createdAt: { type: 'DateTime', attributes: ['@default(now())'] },
          updatedAt: { type: 'DateTime', attributes: ['@updatedAt'] },
        },
      };
      fs.writeFileSync(modelsYamlPath, YAML.stringify(parsed));
      command.success(`Updated models.yaml with ${modelName}`);
    } else {
      command.warn(`Model ${modelName} already exists in models.yaml`);
    }
  }

  if (options.route) {
    // Format: Model:path:method
    const parts = options.route.split(':');
    if (parts.length < 3) {
      command.error('Invalid route format. Use Model:path:method');
      return;
    }

    const [modelName, routePath, method] = parts;
    if (!fs.existsSync(apiYamlPath)) {
      fs.writeFileSync(apiYamlPath, `routes:\n`);
    }

    const content = fs.readFileSync(apiYamlPath, 'utf-8');
    const parsed = YAML.parse(content) || { routes: {} };
    if (!parsed.routes) parsed.routes = {};

    if (!parsed.routes[modelName]) parsed.routes[modelName] = [];

    const exists = parsed.routes[modelName].some(
      (r: RouteSpec) => r.path === routePath && r.method === method,
    );
    if (!exists) {
      parsed.routes[modelName].push({
        path: routePath,
        method: method,
        verb: 'POST',
        input: 'unknown',
        output: 'unknown',
      });
      fs.writeFileSync(apiYamlPath, YAML.stringify(parsed));
      command.success(`Updated api.yaml with route ${routePath}`);
    } else {
      command.warn(`Route ${routePath} already exists for ${modelName} in api.yaml`);
    }
  }
}
