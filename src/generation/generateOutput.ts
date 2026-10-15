import path from "path";
import { type Config, getOutputTargets } from "../schemas/config.schema.js";
import type { RouteFile } from "../types/RouteFile.js";
import { createEndpointFiles } from "./createEndpointFiles.js";
import { createUtilFiles } from "./createUtilFiles.js";

/**
 * Generates the API client into every configured output directory, each with
 * its own resolved options.
 *
 * @returns The full paths of the generated clients
 */
export const generateOutput = async (routes: RouteFile[], config: Config): Promise<string[]> => {
  const writtenPaths: string[] = [];

  try {
    for (const { dir, hooks, exportQueryOptions } of getOutputTargets(config)) {
      const options = {
        name: config.name,
        schemaPackage: config.schemaPackage,
        hooks,
        exportQueryOptions,
      };

      createUtilFiles(options, dir);
      createEndpointFiles(routes, options, dir);
      writtenPaths.push(path.join(dir, config.name));
    }
  }
  catch (error) {
    console.error("Error creating utility files:", error);
    process.exit(1);
  }

  return writtenPaths;
}
