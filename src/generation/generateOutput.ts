import path from "path";
import { type Config, getOutputDirs } from "../schemas/config.schema.js";
import type { RouteFile } from "../types/RouteFile.js";
import { createEndpointFiles } from "./createEndpointFiles.js";
import { createUtilFiles } from "./createUtilFiles.js";

/**
 * Generates the API client into every configured output directory.
 *
 * @returns The full paths of the generated clients
 */
export const generateOutput = async (routes: RouteFile[], config: Config): Promise<string[]> => {
  const writtenPaths: string[] = [];

  try {
    for (const outputDir of getOutputDirs(config)) {
      createUtilFiles(config, outputDir);
      createEndpointFiles(routes, config, outputDir);
      writtenPaths.push(path.join(outputDir, config.name));
    }
  }
  catch (error) {
    console.error("Error creating utility files:", error);
    process.exit(1);
  }

  return writtenPaths;
}
