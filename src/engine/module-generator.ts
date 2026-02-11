import { Project, SourceFile } from 'ts-morph';
import path from 'node:path';
import fs from 'node:fs';
import { Formatter } from '../utils/formatter.js';
import { BaseCommand, logger } from '@nexical/cli-core';

export abstract class ModuleGenerator {
  protected project: Project;
  protected modulePath: string;
  protected moduleName: string;
  protected generatedFiles: Set<string> = new Set();
  protected command?: BaseCommand;

  constructor(modulePath: string, context?: { command?: BaseCommand }) {
    this.modulePath = path.resolve(modulePath);
    this.moduleName = path.basename(this.modulePath);
    this.command = context?.command;
    this.project = new Project({
      // tsConfigFilePath: path.join(process.cwd(), "tsconfig.json"),
      // skipAddingFilesFromTsConfig: true
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        moduleResolution: 2, // Node
        esModuleInterop: true,
        skipLibCheck: true,
        strict: false,
      },
    });
  }

  abstract run(): Promise<void>;

  protected getOrCreateFile(filePath: string): SourceFile {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.modulePath, filePath);
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let file = this.project.getSourceFile(absolutePath);
    if (file && !this.generatedFiles.has(file.getFilePath())) {
      logger.debug(`[ModuleGenerator] [CACHE_EVICT] ${absolutePath}`);
      this.project.removeSourceFile(file);
      file = undefined;
    }

    if (fs.existsSync(absolutePath)) {
      logger.debug(`[ModuleGenerator] [LOAD] ${absolutePath}`);
      file = this.project.addSourceFileAtPath(absolutePath);
    } else {
      logger.debug(`[ModuleGenerator] [CREATE] ${absolutePath}`);
      file = this.project.createSourceFile(absolutePath, '', { overwrite: true });
    }

    const finalizedPath = file.getFilePath();
    logger.debug(`[ModuleGenerator] [ADD_SET] ${finalizedPath}`);
    this.generatedFiles.add(finalizedPath);
    return file;
  }

  protected cleanup(targetDir: string, pattern: RegExp): void {
    const absoluteDir = path.isAbsolute(targetDir)
      ? targetDir
      : path.join(this.modulePath, targetDir);
    if (!fs.existsSync(absoluteDir)) return;

    const files = fs.readdirSync(absoluteDir);
    for (const file of files) {
      const fullPath = path.join(absoluteDir, file);
      if (fs.lstatSync(fullPath).isDirectory()) {
        this.cleanup(fullPath, pattern);
        continue;
      }
      if (pattern.test(file)) {
        const inSet = this.generatedFiles.has(fullPath);

        // Header-based Safe Cleanup
        let shouldDelete = false;
        if (!inSet) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          // Check for generated header
          if (content.includes('// GENERATED CODE - DO NOT MODIFY')) {
            shouldDelete = true;
          } else {
            logger.debug(`[ModuleGenerator] [PRESERVE_MANUAL] ${fullPath}`);
          }
        }

        if (shouldDelete) {
          logger.debug(`[ModuleGenerator] [DELETE] ${fullPath}`);
          fs.unlinkSync(fullPath);
        }
      }
    }
  }

  protected async saveAll(): Promise<void> {
    logger.debug(
      `[ModuleGenerator] [SAVE_ALL] Total project files: ${this.project.getSourceFiles().length}`,
    );

    for (const file of this.project.getSourceFiles()) {
      const filePath = file.getFilePath();
      if (path.basename(filePath).startsWith('__temp_fragment_')) continue;

      const inSet = this.generatedFiles.has(filePath);
      const forgotten = (file as unknown as { wasForgotten(): boolean }).wasForgotten?.() || false;

      logger.debug(
        `[ModuleGenerator] [PROJECT_FILE] ${filePath} | IN_SET: ${inSet} | FORGOTTEN: ${forgotten}`,
      );

      if (inSet) {
        // console.log(`[Reconciler DEBUG] Saving file: ${filePath}`);
        // console.log(`[Reconciler DEBUG] First 100 chars: ${file.getFullText().substring(0, 100)}`);
        logger.debug(`[ModuleGenerator] [SAVE] ${filePath}`);

        // Get the text from ts-morph
        const content = file.getFullText();

        // Format the content
        let formatted = await Formatter.format(content, filePath);

        // FINAL SAFETY: Ensure header is at the very top (after formatter potentially moved it)
        if (formatted.includes('// GENERATED CODE - DO NOT MODIFY')) {
          const { Reconciler } = await import('./reconciler.js');
          formatted = Reconciler.hoistHeader(formatted, '// GENERATED CODE - DO NOT MODIFY');
        }

        // Create directory if it doesn't exist
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Write to disk manually
        fs.writeFileSync(filePath, formatted);
      } else {
        logger.debug(`[ModuleGenerator] [SAVE_SKIP] ${filePath}`);
      }
    }

    // Also check if any files in set are NOT in project
    for (const setPath of this.generatedFiles) {
      if (!this.project.getSourceFile(setPath)) {
        logger.debug(`[ModuleGenerator] [MISSING_FROM_PROJECT] ${setPath}`);
      }
    }
  }
}
