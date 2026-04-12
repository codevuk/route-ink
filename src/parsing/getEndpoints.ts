import { SyntaxKind, type SourceFile } from "ts-morph";
import type { Endpoint } from "../types/Endpoint.js";
import { isInsideHandlerFunction } from "./util/isInsideHandlerFunction.js";

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

export const getEndpoints = (sourceFile: SourceFile, relativePath: string): Endpoint[] => {
  const fastifyParamName = "fastify";

  const endpoints: Endpoint[] = [];

  // Find all call expressions in the file
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    const expression = call.getExpression();

    if (!expression.isKind(SyntaxKind.PropertyAccessExpression)) {
      continue
    }

    const propAccess = expression;
    const objText = propAccess.getExpression().getText().trim();
    const methodName = propAccess.getName().toLowerCase();

    if (objText !== fastifyParamName || !HTTP_METHODS.has(methodName)) {
      continue;
    }

    // Skip if this call is nested inside a handler function (i.e., inside another call's argument)
    if (isInsideHandlerFunction(call)) {
      continue;
    }

    const args = call.getArguments();

    if (args.length < 2) {
      console.warn(`Could not parse route definition at ${relativePath}:${call.getStartLineNumber()} — skipping`);
      continue;
    }

    const pathArg = args[0];
    if (!pathArg?.isKind(SyntaxKind.StringLiteral)) {
      console.warn(`Could not parse route definition at ${relativePath}:${call.getStartLineNumber()} — path must be a string literal, skipping`);
      continue;
    }

    endpoints.push({
      method: methodName.toUpperCase() as Endpoint["method"],
      operationId: "", // We'll fill this in later
      response: {}, // We'll fill this in later
    });
  }

  return endpoints;
}