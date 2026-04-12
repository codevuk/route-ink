import type { Config } from "../schemas/config.schema.js";
import type { RouteFile } from "../types/RouteFile.js";
import { checkOrCreateDirectory } from "./util/checkOrCreateDirectory.js";

export const createEndpointFiles = (routes: RouteFile[], config: Config) => {
  const { outputDir, name } = config;
  const fullOutputPath = `${outputDir}/${name}`;
  const endpointsPath = `${fullOutputPath}/endpoints`;

  checkOrCreateDirectory(endpointsPath);

  for (const routeFile of routes) {

  }
}  