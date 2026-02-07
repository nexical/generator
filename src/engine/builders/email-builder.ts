import { Project, SourceFile } from 'ts-morph';
import { BaseBuilder } from './base-builder.js';
import { type FileDefinition, type ModuleConfig } from '../types.js';
import { Reconciler } from '../reconciler.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { toPascalCase } from '../../utils/string.js';
import { ts } from '../primitives/statements/factory.js';

export interface EmailTemplateConfig {
  id: string;
  name: string;
  props?: { name: string; type: string }[];
}

export interface EmailConfig {
  templates: EmailTemplateConfig[];
}

export class EmailBuilder extends BaseBuilder {
  private emailConfig: EmailConfig = { templates: [] };

  constructor(
    protected moduleName: string,
    protected config: ModuleConfig,
  ) {
    super();
  }

  async build(project: Project, sourceFile: SourceFile | undefined): Promise<void> {
    this.loadEmailConfig();
    if (this.emailConfig.templates.length === 0) return;

    // 1. Generate individual template files
    for (const template of this.emailConfig.templates) {
      this.generateTemplateFile(project, template);
    }

    // 2. Generate src/emails/init.ts
    this.generateInitFile(project);
  }

  private loadEmailConfig() {
    const configPath = join(process.cwd(), 'modules', this.moduleName, 'emails.yaml');
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf8');
        this.emailConfig = parse(content) as EmailConfig;
      } catch {
        console.warn(`[EmailBuilder] Failed to parse emails.yaml for ${this.moduleName}`);
      }
    }
  }

  private generateTemplateFile(project: Project, template: EmailTemplateConfig) {
    const fileName = `src/emails/${toPascalCase(template.name)}.tsx`;
    const file = project.createSourceFile(fileName, '', { overwrite: true });

    const definition: FileDefinition = {
      header: this.getHeader(),
      imports: [
        {
          moduleSpecifier: '@react-email/components',
          namedImports: ['Html', 'Body', 'Container', 'Text', 'Heading', 'Hr'],
        },
      ],
      interfaces: [
        {
          name: `${toPascalCase(template.name)}Props`,
          isExported: true,
          properties: (template.props || []).map((p) => ({
            name: p.name,
            type: p.type,
          })),
        },
      ],
      functions: [
        {
          name: toPascalCase(template.name),
          isExported: true,
          parameters: [{ name: 'props', type: `${toPascalCase(template.name)}Props` }],
          statements: [
            ts`const { ${(template.props || []).map((p) => p.name).join(', ')} } = props;`,
            ts`return (
        <Html>
            <Body style={main}>
                <Container style={container}>
                    <Heading style={h1}>${toPascalCase(template.name)}</Heading>
                    <Text style={text}>Hello! This is an automated email.</Text>
                    <Hr style={hr} />
                    <Text style={footer}>Nexus Ecosystem</Text>
                </Container>
            </Body>
        </Html>
    );`,
          ],
        },
      ],
      variables: [
        {
          name: 'main',
          initializer:
            '{ backgroundColor: "#ffffff", fontFamily: "-apple-system,BlinkMacSystemFont,\\"Segoe UI\\",Roboto,Oxygen-Sans,Ubuntu,Cantarell,\\"Helvetica Neue\\",sans-serif" }',
        },
        {
          name: 'container',
          initializer: '{ margin: "0 auto", padding: "20px 0 48px" }',
        },
        {
          name: 'h1',
          initializer:
            '{ color: "#333", fontSize: "24px", fontWeight: "bold", paddingTop: "0", display: "block" }',
        },
        {
          name: 'text',
          initializer: '{ color: "#333", fontSize: "16px", lineHeight: "26px" }',
        },
        {
          name: 'hr',
          initializer: '{ borderColor: "#cccccc", margin: "20px 0" }',
        },
        {
          name: 'footer',
          initializer: '{ color: "#8898aa", fontSize: "12px" }',
        },
      ],
    };

    Reconciler.reconcile(file, definition);
  }

  private generateInitFile(project: Project) {
    const fileName = 'src/emails/init.ts';
    const file = project.createSourceFile(fileName, '', { overwrite: true });

    const imports = [
      {
        moduleSpecifier: '@/lib/email/email-registry',
        namedImports: ['EmailRegistry'],
      },
    ];

    for (const template of this.emailConfig.templates) {
      imports.push({
        moduleSpecifier: `./${toPascalCase(template.name)}`,
        namedImports: [toPascalCase(template.name)],
      });
    }

    const registrationStatements = this.emailConfig.templates.map(
      (t) => ts`EmailRegistry.register('${t.id}', ${toPascalCase(t.name)});`,
    );

    const definition: FileDefinition = {
      header: this.getHeader(),
      imports,
      functions: [
        {
          name: 'initEmails',
          isExported: true,
          statements: registrationStatements,
        },
      ],
    };

    Reconciler.reconcile(file, definition);
  }

  private getHeader(): string {
    return '// GENERATED CODE - DO NOT MODIFY\n// This file was generated by the EmailBuilder.';
  }

  protected getSchema(): FileDefinition {
    throw new Error('EmailBuilder manages multiple files. Use build().');
  }
}
