import fs from "fs";
import type { Config } from "../schemas/config.schema.js";
import type { RouteFile } from "../types/RouteFile.js";

export const createEndpointFiles = (routes: RouteFile[], config: Config) => {
  const { outputDir, name } = config;
  const fullOutputPath = `${outputDir}/${name}`;
  const endpointsPath = `${fullOutputPath}/endpoints`;

  // Create endpoints directory
  if (!fs.existsSync(endpointsPath)) {
    try {
      fs.mkdirSync(endpointsPath, { recursive: true });
    }
    catch (error) {
      console.error("Error creating endpoints directory:", error);
      process.exit(1);
    }
  }

  for (const routeFile of routes) {

  }
}  