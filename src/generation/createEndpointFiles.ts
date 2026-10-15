import fs from "fs";
import path from "path";
import type { GenerationOptions } from "../schemas/config.schema.js";
import type { RouteFile } from "../types/RouteFile.js";
import { createBarrelFiles } from "./createBarrelFiles.js";
import { createMutationFile } from "./createMutationFile.js";
import { createQueryFile } from "./createQueryFile.js";
import { checkOrCreateDirectory } from "./util/checkOrCreateDirectory.js";
import { getEndpointKind } from "./util/getEndpointShape.js";
import { getRouteNestingLevel, getRouteOutputDirectory } from "./util/getRouteOutputDirectory.js";

export const createEndpointFiles = (routes: RouteFile[], options: GenerationOptions, outputDir: string) => {
  const { name } = options;
  const fullOutputPath = path.join(outputDir, name);
  const endpointsPath = path.join(fullOutputPath, "endpoints");

  checkOrCreateDirectory(endpointsPath);

  for (const routeFile of routes) {
    const { relativePath } = routeFile;
    const routeOutputDirectory = getRouteOutputDirectory(relativePath);
    const nestingLevel = getRouteNestingLevel(relativePath);
    const endpointFileDirectory = routeOutputDirectory === ""
      ? endpointsPath
      : path.join(endpointsPath, routeOutputDirectory);

    for (const endpoint of routeFile.endpoints) {
      const kind = getEndpointKind(endpoint);

      if (!kind) {
        continue;
      }

      const contents = kind === "query"
        ? createQueryFile(endpoint, options, nestingLevel)
        : createMutationFile(endpoint, options, nestingLevel);

      checkOrCreateDirectory(endpointFileDirectory);

      const outputFilePath = path.join(endpointFileDirectory, `${endpoint.operationId}.ts`);
      fs.writeFileSync(outputFilePath, contents);
    }
  }

  createBarrelFiles(routes, fullOutputPath, options);
};
