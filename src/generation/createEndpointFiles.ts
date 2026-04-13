import fs from "fs";
import type { Config } from "../schemas/config.schema.js";
import type { RouteFile } from "../types/RouteFile.js";
import { createQueryFile } from "./createQueryFile.js";
import { checkOrCreateDirectory } from "./util/checkOrCreateDirectory.js";

export const createEndpointFiles = (routes: RouteFile[], config: Config) => {
  const { outputDir, name } = config;
  const fullOutputPath = `${outputDir}/${name}`;
  const endpointsPath = `${fullOutputPath}/endpoints`;

  checkOrCreateDirectory(endpointsPath);

  for (const routeFile of routes) {
    const { relativePath } = routeFile;
    const endpointFileDirectory = `${config.outputDir}/${config.name}/endpoints/${relativePath.replace(".route.ts", "")}`;

    checkOrCreateDirectory(endpointFileDirectory);

    for (const endpoint of routeFile.endpoints) {
      if (endpoint.method === "GET") {
        const contents = createQueryFile(endpoint, config, relativePath.split("/").length + 1);
        const outputFilePath = `${endpointFileDirectory}/${endpoint.operationId}.ts`;
        fs.writeFileSync(outputFilePath, contents);
      }
    }
  }
}  