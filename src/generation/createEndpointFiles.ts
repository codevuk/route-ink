import fs from "fs";
import path from "path";
import type { Config } from "../schemas/config.schema.js";
import type { RouteFile } from "../types/RouteFile.js";
import { createBarrelFiles } from "./createBarrelFiles.js";
import { createMutationFile } from "./createMutationFile.js";
import { createQueryFile } from "./createQueryFile.js";
import { checkOrCreateDirectory } from "./util/checkOrCreateDirectory.js";
import { getRouteNestingLevel, getRouteOutputDirectory } from "./util/getRouteOutputDirectory.js";

export const createEndpointFiles = (routes: RouteFile[], config: Config) => {
  const { outputDir, name } = config;
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
      if (endpoint.method === "GET") {
        const contents = createQueryFile(endpoint, config, nestingLevel);

        if (!contents) {
          continue;
        }

        checkOrCreateDirectory(endpointFileDirectory);

        const outputFilePath = path.join(endpointFileDirectory, `${endpoint.operationId}.ts`);
        fs.writeFileSync(outputFilePath, contents);
      }
      else if (endpoint.method === "POST" || endpoint.method === "PUT" || endpoint.method === "PATCH" || endpoint.method === "DELETE") {
        const contents = createMutationFile(endpoint, config, nestingLevel);

        if (!contents) {
          continue;
        }

        checkOrCreateDirectory(endpointFileDirectory);

        const outputFilePath = path.join(endpointFileDirectory, `${endpoint.operationId}.ts`);
        fs.writeFileSync(outputFilePath, contents);
      }
    }
  }

  createBarrelFiles(routes, fullOutputPath);
};