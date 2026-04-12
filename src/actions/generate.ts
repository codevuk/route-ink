import path from "path";
import { Project } from "ts-morph";
import { derivePrefix } from "../parsing/derivePrefix.js";
import { findRouteFiles } from "../parsing/findRouteFiles.js";
import { getSchemaImports } from "../parsing/getSchemaImports.js";
import type { RouteFile } from "../types/RouteFile.js";
import { logger } from "../util/logger.js";
import { loadConfig } from "./load-config.js";

export const generate = async () => {
  console.log("Generating API client...");
  // Lets first load the config
  try {
    const result = await loadConfig();

    if (!result.success) {
      console.error("Failed to load config:", result.error);
      return process.exit(1);
    }

    const { config } = result;

    const sourceRouteFiles = findRouteFiles(config.routesDir);

    console.log("Found route files:");

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

      routes.push({
        fullPath: filePath,
        relativePath,
        route: prefix,
        sourceFile,
        schemaImports: getSchemaImports(sourceFile, config),
      });
    }

    logger(routes);

  }
  catch (error) {
    console.error("Error loading config:", error);
    process.exit(1);
  }
}