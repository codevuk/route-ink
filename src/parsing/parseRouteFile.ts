import path from "path";
import { Project } from "ts-morph";
import type { Config } from "../schemas/config.schema.js";
import type { RouteFile } from "../types/RouteFile.js";
import { derivePrefix } from "./derivePrefix.js";
import { findRouteFiles } from "./findRouteFiles.js";
import { getEndpoints } from "./getEndpoints.js";
import { getSchemaImports } from "./getSchemaImports.js";

export const parseRouteFiles = (config: Config): RouteFile[] => {
  const sourceRouteFiles = findRouteFiles(config.routesDir);

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      skipLibCheck: true,
      noEmit: true,
    },
  });

  const routes: RouteFile[] = [];

  for (const filePath of sourceRouteFiles) {
    const sourceFile = project.addSourceFileAtPath(filePath);
    const relativePath = path.relative(config.routesDir, filePath);
    const prefix = derivePrefix(relativePath);
    const schemaImports = getSchemaImports(sourceFile, config);

    routes.push({
      fullPath: filePath,
      relativePath,
      route: prefix,
      sourceFile,
      schemaImports,
      endpoints: getEndpoints(sourceFile, relativePath, prefix, schemaImports),
    });
  }

  return routes;
}