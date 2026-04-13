import type { RouteFile } from "../types/RouteFile.js";

export const validateRouteFiles = (routeFiles: RouteFile[]) => {
  const errors: string[] = [];

  const operationIds = new Set<string>();

  for (const routeFile of routeFiles) {
    const { endpoints } = routeFile;

    for (const endpoint of endpoints) {
      if (operationIds.has(endpoint.operationId)) {
        errors.push(`Duplicate operationId "${endpoint.operationId}" found in route file "${routeFile.relativePath}". OperationIds must be unique across all route files.`);
      } else {
        operationIds.add(endpoint.operationId);
      }

      // Check if it starts with an uppercase letter and only contains valid characters (alphanumeric and underscores)
      if (/^[a-z]/.test(endpoint.operationId)) {
        errors.push(`Invalid operationId "${endpoint.operationId}" in route file "${routeFile.relativePath}". OperationIds must start with an uppercase letter.`);
      } else if (!/^[A-Za-z0-9_]+$/.test(endpoint.operationId)) {
        errors.push(`Invalid operationId "${endpoint.operationId}" in route file "${routeFile.relativePath}". OperationIds can only contain letters, numbers, and underscores.`);
      }
    }
  }

  return errors;
}