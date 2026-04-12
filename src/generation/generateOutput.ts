import type { Config } from "../schemas/config.schema.js";
import type { RouteFile } from "../types/RouteFile.js";
import { deduplicate } from "../util/deduplicate.js";

export const generateOutput = async (routes: RouteFile, config: Config) => {
  const { outputDir, schemaPackage } = config;

  const imports = deduplicate(routes.schemaImports);
}