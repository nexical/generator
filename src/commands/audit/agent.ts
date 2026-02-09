import { BaseCommand } from '@nexical/cli-core';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { z } from 'zod';
import { ModuleLocator, type ModuleInfo } from '../../lib/module-locator.js';

// Zod schema for agents.yaml validation
const AgentConfigSchema = z.object({
  name: z.string(),
  type: z.enum(['job', 'persistent']),
  description: z.string().optional(),
  jobType: z.string().optional(), // Required for 'job' type
  schema: z.string().optional(), // Zod schema name for validation
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

export default class AuditAgentCommand extends BaseCommand {
  static usage = 'audit agent';
  static description = 'Audit agent definitions in agents.yaml';

  static args = {
    args: [
      {
        name: 'name',
        description: 'The name of the module (or glob pattern) to audit. Defaults to "*-api".',
        required: false,
      },
    ],
    options: [
      {
        name: '--schema',
        description: 'Validate agents.yaml schemas only (no code audit)',
      },
      {
        name: '--verbose',
        description: 'Show detailed output',
      },
    ],
  };

  async run(options: { name?: string; schema?: boolean; verbose?: boolean }) {
    const pattern = options.name || '*-api';
    const modules = await ModuleLocator.expand(pattern);

    if (modules.length === 0) {
      this.warn(`No modules found matching pattern "${pattern}"`);
      return;
    }

    this.info(`Auditing ${modules.length} module(s) for agent definitions...`);

    const results: ValidationResult[] = [];

    for (const moduleInfo of modules) {
      const result = await this.auditModule(moduleInfo, options);
      if (result) results.push(result);
    }

    // Summary
    this.printSummary(results);
  }

  private async auditModule(
    moduleInfo: ModuleInfo,
    options: { schema?: boolean; verbose?: boolean },
  ): Promise<ValidationResult | null> {
    const { name: moduleName, path: moduleDir } = moduleInfo;
    const agentsYamlPath = path.join(moduleDir, 'agents.yaml');

    // Check if agents.yaml exists
    if (!fs.existsSync(agentsYamlPath)) {
      if (options.verbose) {
        this.info(`  ${moduleName}: No agents.yaml found`);
      }
      return null;
    }

    this.info(`Auditing ${moduleName}...`);
    const result: ValidationResult = {
      moduleName,
      errors: [],
      warnings: [],
      agents: [],
    };

    try {
      // Parse YAML
      const content = fs.readFileSync(agentsYamlPath, 'utf-8');
      const parsed = YAML.parse(content);

      // Schema validation
      const schemaResult = AgentsYamlSchema.safeParse(parsed);
      if (!schemaResult.success) {
        for (const error of schemaResult.error.errors) {
          result.errors.push(`Schema: ${error.path.join('.')} - ${error.message}`);
        }
        this.error(`${moduleName}: Schema validation failed`);
        return result;
      }

      const agentsConfig = schemaResult.data;
      result.agents = agentsConfig.agents.map((a) => a.name);

      // If schema-only mode, we're done
      if (options.schema) {
        this.success(`${moduleName}: Schema valid (${result.agents.length} agents)`);
        return result;
      }

      // Code audit  Check if generated files exist
      for (const agent of agentsConfig.agents) {
        const agentFilePath = path.join(moduleDir, 'src', 'agent', `${agent.name}.ts`);

        if (!fs.existsSync(agentFilePath)) {
          result.warnings.push(
            `Missing: src/agent/${agent.name}.ts (run 'arc gen api ${moduleName}')`,
          );
        } else {
          // Check if file has required structure
          const fileContent = fs.readFileSync(agentFilePath, 'utf-8');

          if (agent.type === 'job') {
            if (!fileContent.includes('JobProcessor')) {
              result.errors.push(`${agent.name}: Missing JobProcessor base class`);
            }
            if (!fileContent.includes(`jobType`)) {
              result.errors.push(`${agent.name}: Missing jobType property`);
            }
            if (!fileContent.includes(`process(`)) {
              result.errors.push(`${agent.name}: Missing process() method`);
            }
          } else if (agent.type === 'persistent') {
            if (!fileContent.includes('PersistentAgent')) {
              result.errors.push(`${agent.name}: Missing PersistentAgent base class`);
            }
            if (!fileContent.includes(`run(`)) {
              result.errors.push(`${agent.name}: Missing run() method`);
            }
          }
        }
      }

      // Report
      if (result.errors.length > 0) {
        this.error(`${moduleName}: ${result.errors.length} error(s)`);
      } else if (result.warnings.length > 0) {
        this.warn(`${moduleName}: ${result.warnings.length} warning(s)`);
      } else {
        this.success(`${moduleName}: All ${result.agents.length} agents valid`);
      }

      return result;
    } catch (error) {
      this.error(`${moduleName}: Parse error`);
      result.errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  private printSummary(results: ValidationResult[]) {
    this.info('');
    this.info('Summary:');

    const totalAgents = results.reduce((sum, r) => sum + r.agents.length, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

    this.info(`  Modules: ${results.length}`);
    this.info(`  Agents: ${totalAgents}`);
    this.info(`  Errors: ${totalErrors > 0 ? totalErrors : '0'}`);
    this.info(`  Warnings: ${totalWarnings > 0 ? totalWarnings : '0'}`);

    // Detail errors
    for (const result of results) {
      if (result.errors.length > 0 || result.warnings.length > 0) {
        this.info('');
        this.info(`${result.moduleName}:`);
        for (const error of result.errors) {
          this.error(`  ✗ ${error}`);
        }
        for (const warning of result.warnings) {
          this.warn(`  ⚠ ${warning}`);
        }
      }
    }
  }
}
