import { Project, SourceFile } from 'ts-morph';

export class TestProject {
  project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      skipAddingFilesFromTsConfig: true,
    });
  }

  createSourceFile(fileName: string, content: string): SourceFile {
    // Prevent collisions in parallel tests by ensuring unique filenames
    if (fileName === 'test.ts') {
      const uniqueName = `test-${Math.random().toString(36).substring(2, 9)}.ts`;
      return this.project.createSourceFile(uniqueName, content);
    }
    return this.project.createSourceFile(fileName, content);
  }

  getSourceFile(fileName: string): SourceFile | undefined {
    return this.project.getSourceFile(fileName);
  }
}

export function createTestProject() {
  return new TestProject();
}
