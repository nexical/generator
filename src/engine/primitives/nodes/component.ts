import {
  SourceFile,
  FunctionDeclaration,
  VariableStatement,
  ModuleDeclaration,
  ArrowFunction,
  SyntaxKind,
  ReturnStatement,
  VariableDeclarationKind,
} from 'ts-morph';
import { BasePrimitive } from '../core/base-primitive.js';
import { type ComponentConfig } from '../../types.js';
import { Normalizer } from '../../../utils/normalizer.js';

export class ComponentPrimitive extends BasePrimitive<
  FunctionDeclaration | VariableStatement,
  ComponentConfig
> {
  find(parent: SourceFile | ModuleDeclaration) {
    // Try to find FunctionDeclaration
    const func = parent.getFunction(this.config.name);
    if (func) return func;

    // Try to find VariableStatement
    const variable = parent.getVariableStatement((v) =>
      v
        .getDeclarationList()
        .getDeclarations()
        .some((d) => d.getName() === this.config.name),
    );
    return variable;
  }

  create(parent: SourceFile | ModuleDeclaration): VariableStatement {
    // Default to const Arrow Function
    const node = parent.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      isExported: this.config.isExported,
      isDefaultExport: this.config.isDefaultExport,
      declarations: [
        {
          name: this.config.name,
          initializer: '(props) => {\n  return null;\n}',
        },
      ],
    });

    this.update(node);
    return node;
  }

  update(node: FunctionDeclaration | VariableStatement) {
    let funcNode: FunctionDeclaration | ArrowFunction | undefined;

    if (node instanceof FunctionDeclaration) {
      funcNode = node;
    } else if (node.getKindName() === 'VariableStatement') {
      const decl = (node as VariableStatement)
        .getDeclarationList()
        .getDeclarations()
        .find((d) => d.getName() === this.config.name);
      if (decl) {
        const init = decl.getInitializer();
        if (init && init.getKind() === SyntaxKind.ArrowFunction) {
          funcNode = init as ArrowFunction;
        }
      }
    }

    if (!funcNode) return;

    // Reconcile Props
    this.reconcileProps(funcNode);

    // Reconcile Body (JSX)
    this.reconcileBody(funcNode);
  }

  private reconcileProps(node: FunctionDeclaration | ArrowFunction) {
    // Currently, we assume a single 'props' object or individual props?
    // React components usually take (props) or ({ name, title }).
    // Our ComponentConfig has `props: ComponentProp[]`.
    // Let's assume destructive update of the first parameter to be destructured props
    // if props are defined.
    // If props is empty/undefined, maybe we don't touch parameters?

    if (!this.config.props || this.config.props.length === 0) return;

    const params = node.getParameters();
    const propsParam = params[0];

    // Build the destructuring text: "{ title, count }: { title: string; count: number }"
    // or just "props: PropsType"
    // For now, let's use inline destructuring with types:
    // ({ foo, bar }: { foo: string, bar: number })

    const propNames = this.config.props.map((p) => p.name).join(', ');
    const propTypes = this.config.props.map((p) => `${p.name}: ${p.type}`).join('; ');

    const newText = `{ ${propNames} }: { ${propTypes} }`;

    if (propsParam) {
      // Logic to check if we should update.
      // If the user has changed it significantly, we might want to respect it?
      // But ComponentPrimitive usually owns the contract.
      // Let's check drift.
      const currentText = propsParam.getText();
      // Simple heuristic: if names missing, update.
      if (
        this.config.props.some((p) => !currentText.includes(p.name)) ||
        Normalizer.normalize(currentText) !== Normalizer.normalize(newText)
      ) {
        propsParam.replaceWithText(newText);
      }
    } else {
      node.addParameter({
        name: `{ ${propNames} }`,
        type: `{ ${propTypes} }`,
      });
    }
  }

  private reconcileBody(node: FunctionDeclaration | ArrowFunction) {
    // 1. Get the return statement from the config (the "Render")
    const renderConfig = this.config.render;
    if (!renderConfig) return;

    // The renderConfig describes the DESIRED return statement.
    // It is a ParsedStatement (which has .getNodes -> [ReturnStatement])

    // 2. Find existing return statement in the body
    // Using getStatementByKind or iterating
    const existingReturn = node
      .getStatements()
      .find((s) => s.getKind() === SyntaxKind.ReturnStatement) as ReturnStatement | undefined;

    // 3. Generate the new nodes
    // We cannot just call .generate() because ParsedStatement needs 'project'.
    // We use getNodes using the node's project.
    const newNodes = renderConfig.getNodes(node.getProject());
    const newReturn = newNodes[0] as ReturnStatement;

    if (!newReturn || newReturn.getKind() !== SyntaxKind.ReturnStatement) {
      // Warning: configured render did not produce a return statement
      return;
    }

    const newExpression = newReturn.getExpression();
    if (!newExpression) return;
    const newText = newExpression.getText();

    if (!existingReturn) {
      // No return? Add it.
      node.addStatements(newReturn.getText());
    } else {
      // Compare expressions
      const existingExpression = existingReturn.getExpression();
      // If existing has no expression (return;), overwrite.
      if (!existingExpression) {
        existingReturn.replaceWithText(newReturn.getText());
        return;
      }

      const existingText = existingExpression.getText();

      // Normalize and compare
      if (Normalizer.normalize(existingText) !== Normalizer.normalize(newText)) {
        // They differ. Update expression.
        // Note: We only replace the expression to preserve the 'return' keyword and potential comments?
        // Or replace whole statement. Replacing whole statement is safer for AST.
        existingReturn.replaceWithText(newReturn.getText());
      }
    }

    // Clean up temporary nodes from getNodes if necessary?
    // config.getNodes created a temporary source file.
    // ts-morph might need manual cleanup if strictly managing memory, but for a generator run it's fine.
    // Actually getNodes in factory.ts creates a sourceFile. We should probably delete it if we can access it.
    // implementation in factory.ts returns [returnStmt]. returnStmt.getSourceFile().delete();
    // But we need to use the text first.
    // The nodes are in a temporary source file.
    // We extracted text. Now we can delete.
    // We extracted text. Now we can delete.
    if (renderConfig.cleanup) {
      renderConfig.cleanup();
    } else {
      // Fallback for objects that might not have cleanup (legacy)
      newReturn.getSourceFile().delete();
    }
  }
}
