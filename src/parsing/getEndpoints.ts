import { ObjectLiteralExpression, SyntaxKind, type SourceFile } from "ts-morph";
import type { Endpoint } from "../types/Endpoint.js";
import { extractSchemaIdentifiers } from "./util/extractSchemaIdentifiers.js";
import { getPropertyAssignment } from "./util/getPropertyAssignment.js";
import { getPropertyObjectValue } from "./util/getPropertyObjectValue.js";
import { getPropertyValue } from "./util/getPropertyValue.js";
import { isInsideHandlerFunction } from "./util/isInsideHandlerFunction.js";
import { joinPaths } from "./util/joinPaths.js";
import { parseResponseObject } from "./util/parseResponseObject.js";

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

export const getEndpoints = (
  sourceFile: SourceFile,
  relativePath: string,
  prefix: string,
  availableSchemaImports: string[]
): Endpoint[] => {
  const fastifyParamName = "fastify";
  const availableImportsSet = new Set(availableSchemaImports);

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

    const routePath = pathArg.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
    const fullPath = joinPaths(prefix, routePath);
    const line = call.getStartLineNumber();

    // Second argument: options object.
    // If it's a function (2-arg form: path + handler), there's no schema — silently skip.
    const optionsArg = args[1];

    if (optionsArg?.isKind(SyntaxKind.ArrowFunction) || optionsArg?.isKind(SyntaxKind.FunctionExpression)) {
      continue;
    }

    if (!optionsArg?.isKind(SyntaxKind.ObjectLiteralExpression)) {
      console.warn(`Could not parse route definition at ${relativePath}:${line} — skipping`);
      continue;
    }

    const optionsObj = optionsArg as ObjectLiteralExpression;
    const schemaPropNode = getPropertyAssignment(optionsObj, 'schema');

    // No schema at all — silently skip (health checks etc.)
    if (!schemaPropNode) {
      continue;
    }

    const schemaInit = schemaPropNode.getInitializer();

    if (!schemaInit || !schemaInit.isKind(SyntaxKind.ObjectLiteralExpression)) {
      console.warn(`Could not parse schema at ${relativePath}:${line} — skipping`);
      continue;
    }

    const schemaObj = schemaInit as ObjectLiteralExpression;

    // Extract schema identifiers for this endpoint
    const endpointSchemaImports = new Set<string>();

    // Extract from body
    const bodyProp = getPropertyAssignment(schemaObj, 'body');
    if (bodyProp) {
      const identifiers = extractSchemaIdentifiers(bodyProp.getInitializer(), availableImportsSet);
      identifiers.forEach(id => endpointSchemaImports.add(id));
    }

    // Extract from query/querystring
    const queryProp = getPropertyAssignment(schemaObj, 'querystring');
    if (queryProp) {
      const identifiers = extractSchemaIdentifiers(queryProp.getInitializer(), availableImportsSet);
      identifiers.forEach(id => endpointSchemaImports.add(id));
    }

    // Extract from params
    const paramsProp = getPropertyAssignment(schemaObj, 'params');
    if (paramsProp) {
      const identifiers = extractSchemaIdentifiers(paramsProp.getInitializer(), availableImportsSet);
      identifiers.forEach(id => endpointSchemaImports.add(id));
    }

    // Extract from response
    const responseProp = getPropertyAssignment(schemaObj, 'response');
    if (responseProp) {
      const identifiers = extractSchemaIdentifiers(responseProp.getInitializer(), availableImportsSet);
      identifiers.forEach(id => endpointSchemaImports.add(id));
    }

    endpoints.push({
      method: methodName.toUpperCase() as Endpoint["method"],
      path: fullPath,
      operationId: getPropertyValue(schemaObj, 'operationId') || "",
      body: getPropertyValue(schemaObj, 'body'),
      query: getPropertyValue(schemaObj, 'querystring'),
      params: getPropertyValue(schemaObj, 'params'),
      response: parseResponseObject(getPropertyObjectValue(schemaObj, 'response') || {}),
      schemaImports: Array.from(endpointSchemaImports),
    });
  }

  return endpoints;
}