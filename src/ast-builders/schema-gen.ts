import ts from 'typescript';
import { type PlatformDefinition, type PlatformModel } from '../schema.js';

const { factory } = ts;

export class ZodSchemaGenerator {
  static generate(definition: PlatformDefinition): ts.SourceFile {
    const statements: ts.Statement[] = [];

    // Add Import: import { z } from 'zod';
    statements.push(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(false, undefined, factory.createIdentifier('z')),
          ]),
        ),
        factory.createStringLiteral('zod'),
        undefined,
      ),
    );

    // Generate Enums
    if (definition.enums) {
      for (const [name, enumDef] of Object.entries(definition.enums)) {
        statements.push(this.createZodEnum(name, (enumDef as { values: string[] }).values));
      }
    }

    // Generate Models
    if (definition.models) {
      for (const [name, model] of Object.entries(definition.models)) {
        statements.push(this.createZodModel(name, model));
      }
    }

    return factory.createSourceFile(
      statements,
      factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.None,
    );
  }

  private static createZodEnum(name: string, values: string[]): ts.VariableStatement {
    // export const NameSchema = z.enum(['A', 'B']);
    return factory.createVariableStatement(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier(`${name}Schema`),
            undefined,
            undefined,
            factory.createCallExpression(
              factory.createPropertyAccessExpression(factory.createIdentifier('z'), 'enum'),
              undefined,
              [
                factory.createArrayLiteralExpression(
                  values.map((v) => factory.createStringLiteral(v)),
                  false,
                ),
              ],
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );
  }

  private static createZodModel(name: string, model: PlatformModel): ts.VariableStatement {
    // export const NameSchema = z.object({ ... });
    const propertyAssignments: ts.PropertyAssignment[] = [];

    for (const [fieldName, fieldDef] of Object.entries(model.fields)) {
      propertyAssignments.push(
        this.createZodField(
          fieldName,
          fieldDef as { type: string; isRequired?: boolean; isList?: boolean },
        ),
      );
    }

    return factory.createVariableStatement(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier(`${name}Schema`),
            undefined,
            undefined,
            factory.createCallExpression(
              factory.createPropertyAccessExpression(factory.createIdentifier('z'), 'object'),
              undefined,
              [factory.createObjectLiteralExpression(propertyAssignments, true)],
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );
  }

  private static createZodField(
    name: string,
    def: string | { type: string; isRequired?: boolean; isList?: boolean },
  ): ts.PropertyAssignment {
    let typeName: string;
    let isRequired = true; // Default to true unless specified
    let isList = false;

    if (typeof def === 'string') {
      const parts = def.split(' ');
      typeName = parts[0];
      // naive shorthand check
      if (typeName.endsWith('?')) {
        typeName = typeName.slice(0, -1);
        isRequired = false;
      }
      if (typeName.endsWith('[]')) {
        typeName = typeName.slice(0, -2);
        isList = true;
      }
    } else {
      typeName = def.type;
      isRequired = def.isRequired ?? true;
      isList = def.isList ?? false;

      // Handle explicit type having []
      if (typeName.endsWith('[]')) {
        typeName = typeName.slice(0, -2);
        isList = true;
      }
    }

    let zodType: ts.Expression = this.mapTypeToZod(typeName);

    if (isList) {
      zodType = factory.createCallExpression(
        factory.createPropertyAccessExpression(zodType, 'array'),
        undefined,
        [],
      );
    }

    if (!isRequired) {
      zodType = factory.createCallExpression(
        factory.createPropertyAccessExpression(zodType, 'optional'),
        undefined,
        [],
      );
      // Also potentially .nullable() if it matches Prisma behavior?
      // For now, let's stick to .optional() for input schemas
    }

    return factory.createPropertyAssignment(factory.createIdentifier(name), zodType);
  }

  private static mapTypeToZod(type: string): ts.Expression {
    const z = factory.createIdentifier('z');
    let base: ts.Expression;

    switch (type) {
      case 'String':
      case 'string':
        base = factory.createPropertyAccessExpression(z, 'string');
        break;
      case 'Int':
      case 'Float':
      case 'Decimal':
      case 'number':
        base = factory.createPropertyAccessExpression(z, 'number');
        break;
      case 'Boolean':
      case 'boolean':
        base = factory.createPropertyAccessExpression(z, 'boolean');
        break;
      case 'DateTime':
      case 'Date':
        base = factory.createPropertyAccessExpression(z, 'date');
        break;
      case 'Json':
        base = factory.createPropertyAccessExpression(z, 'any');
        break;
      default: {
        // Assume it's an enum or another model
        const schemaId = factory.createIdentifier(`${type}Schema`);
        // Use z.lazy(() => NameSchema) to handle hoisting/circular deps
        return factory.createCallExpression(
          factory.createPropertyAccessExpression(factory.createIdentifier('z'), 'lazy'),
          undefined,
          [
            factory.createArrowFunction(
              undefined,
              undefined,
              [],
              undefined,
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              schemaId,
            ),
          ],
        );
      }
    }

    return factory.createCallExpression(base, undefined, []);
  }
}
