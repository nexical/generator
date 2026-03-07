import { BaseCommand } from '@nexical/cli-core';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { ModuleLocator, type ModuleInfo } from './module-locator.js';

const AgentConfigSchema = z.object({
  name: z.string(),
  type: z.enum(['job', 'persistent']),
  description: z.string().optional(),
  jobType: z.string().optional(),
  schema: z.string().optional(),
});

const AgentsYamlSchema = z.object({
  agents: z.array(AgentConfigSchema),
});

interface ValidationResult {
  moduleName: string;
  errors: string[];
  warnings: string[];
  agents: string[];
}

export async function auditAgentModule(
  command: BaseCommand,
  pattern: string,
  options: { schema?: boolean; verbose?: boolean },
) {
  const modules = await ModuleLocator.expand(pattern);

  if (modules.length === 0) {
    command.warn(`No modules found matching pattern "${pattern}"`);
    return;
  }

  command.info(`Auditing ${modules.length} module(s) for agent definitions...`);

  const results: ValidationResult[] = [];

  for (const moduleInfo of modules) {
    const result = await auditSingleModule(command, moduleInfo, options);
    if (result) results.push(result);
  }

  const totalAgents = results.reduce((sum, r) => sum + r.agents.length, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  command.info('');
  command.info('Summary:');
  command.info(`  Modules: ${results.length}`);
  command.info(`  Agents: ${totalAgents}`);
  command.info(`  Errors: ${totalErrors > 0 ? totalErrors : '0'}`);
  command.info(`  Warnings: ${totalWarnings > 0 ? totalWarnings : '0'}`);

  if (totalErrors > 0) {
    command.error(`Audit failed for ${results.length} modules.`);
  } else {
    command.success(`Audit passed for all ${results.length} modules.`);
  }

  for (const result of results) {
    if (result.errors.length > 0 || result.warnings.length > 0) {
      command.info('');
      command.info(`${result.moduleName}:`);
      for (const error of result.errors) command.error(`  ✗ ${error}`);
      for (const warning of result.warnings) command.warn(`  ⚠ ${warning}`);
    }
  }
}

async function auditSingleModule(
  command: BaseCommand,
  moduleInfo: ModuleInfo,
  options: { schema?: boolean; verbose?: boolean },
): Promise<ValidationResult | null> {
  const { name: moduleName, path: moduleDir } = moduleInfo;
  const agentsYamlPath = path.join(moduleDir, 'agents.yaml');

  if (!fs.existsSync(agentsYamlPath)) {
    if (options.verbose) command.info(`  ${moduleName}: No agents.yaml found`);
    return { moduleName, errors: ['agents.yaml not found'], warnings: [], agents: [] };
  }

  command.info(`Auditing ${moduleName}...`);
  const result: ValidationResult = { moduleName, errors: [], warnings: [], agents: [] };

  try {
    const content = fs.readFileSync(agentsYamlPath, 'utf-8');
    const parsed = YAML.parse(content);

    let agents: z.infer<typeof AgentConfigSchema>[] = [];
    if (parsed.agents && Array.isArray(parsed.agents)) {
      const schemaResult = AgentsYamlSchema.safeParse(parsed);
      if (!schemaResult.success) {
        command.info(`[${moduleName}] Schema validation issues:`);
        for (const error of schemaResult.error.issues) {
          const msg = `Schema: ${error.path.join('.')} - ${error.message}`;
          result.errors.push(msg);
          command.info(`  - ${msg}`);
        }
        return result;
      }
      agents = schemaResult.data.agents;
    } else {
      for (const [name, def] of Object.entries(parsed)) {
        if (name === 'agents') continue;
        const agentDef = def as z.infer<typeof AgentConfigSchema>;
        agents.push({ ...agentDef, name });
      }
    }

    result.agents = agents.map((a) => a.name);

    if (options.schema) {
      command.success(`${moduleName}: Schema valid (${result.agents.length} agents)`);
      return result;
    }

    for (const agent of agents) {
      const agentFilePath = path.join(moduleDir, 'src', 'agent', `${agent.name}.ts`);
      if (!fs.existsSync(agentFilePath)) {
        result.warnings.push(`Missing: src/agent/${agent.name}.ts`);
      } else {
        const fileContent = fs.readFileSync(agentFilePath, 'utf-8');
        if (
          agent.type === 'job' &&
          (!fileContent.includes('JobProcessor') || !fileContent.includes('process('))
        ) {
          result.errors.push(`${agent.name}: Invalid JobProcessor implementation`);
        } else if (
          agent.type === 'persistent' &&
          (!fileContent.includes('PersistentAgent') || !fileContent.includes('run('))
        ) {
          result.errors.push(`${agent.name}: Invalid PersistentAgent implementation`);
        }
      }
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
      command.success(`${moduleName}: All ${result.agents.length} agents valid`);
    }

    return result;
  } catch (error) {
    command.error(`${moduleName}: Parse error`);
    result.errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}
