import { SyntaxKind, type CallExpression, type Node } from "ts-morph";

/**
 * Checks if a call expression is nested inside a handler function
 * (i.e., the 3rd argument of an outer route call or inside an async arrow function argument).
 */
export function isInsideHandlerFunction(call: CallExpression): boolean {
  let current: Node = call;

  while (true) {
    const parent = current.getParent();
    if (!parent) {
      return false;
    }

    // If inside an arrow function or function expression that is itself
    // an argument to another call, we are in a handler
    if (
      (parent.isKind(SyntaxKind.ArrowFunction) || parent.isKind(SyntaxKind.FunctionExpression)) &&
      parent.getParent()?.isKind(SyntaxKind.SyntaxList)
    ) {
      const grandParent = parent.getParent()?.getParent();
      if (grandParent?.isKind(SyntaxKind.CallExpression)) {
        return true;
      }
    }

    // Stop at source file
    if (parent.isKind(SyntaxKind.SourceFile)) {
      return false;
    }

    current = parent;
  }
}