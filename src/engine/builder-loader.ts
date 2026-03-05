import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { glob } from 'glob';
import { logger } from '@nexical/cli-core';
import type { Project, SourceFile } from 'ts-morph';

export interface ModuleBuilderContext {
  moduleName: string;
  modulePath: string;
  [key: string]: unknown;
}

export class BuilderLoader {
  static async loadAndRun(
    modulePath: string,
    project: Project,
    context: ModuleBuilderContext,
    getOrCreateFile: (filePath: string) => SourceFile,
  ): Promise<void> {
    const buildersDir = path.join(modulePath, 'generator/builders');

    if (!fs.existsSync(buildersDir)) {
      return;
    }

    logger.info(`[BuilderLoader] Scanning for custom builders in ${buildersDir}`);

    const builderFiles = await glob('**/*.ts', { cwd: buildersDir, absolute: true });

    for (const file of builderFiles) {
      try {
        const fileUrl = pathToFileURL(file).href;
        const module = await import(fileUrl);

        // Look for a default export that is a class extending BaseBuilder
        const BuilderClass = module.default;

        if (BuilderClass && typeof BuilderClass === 'function') {
          const builderInstance = new BuilderClass(context);
          // We assume the custom builder has a 'run' or 'build' method,
          // or we can just expect it to use the standard 'ensure' if it knows the target file.
          // However, to be flexible, let's check for a 'run' method that takes the project and helper.
          if (typeof builderInstance.run === 'function') {
            logger.info(`[BuilderLoader] Running custom builder from ${path.basename(file)}`);
            await builderInstance.run(project, getOrCreateFile);
          } else {
            logger.warn(
              `[BuilderLoader] Custom builder ${path.basename(file)} does not have a 'run(project, getOrCreateFile)' method.`,
            );
          }
        } else {
          logger.warn(
            `[BuilderLoader] File ${path.basename(file)} does not export a default class.`,
          );
        }
      } catch (e) {
        logger.error(
          `[BuilderLoader] Failed to load or run builder ${file}:`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }
}
