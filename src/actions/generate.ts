import { generateOutput } from "../generation/generateOutput.js";
import { parseRouteFiles } from "../parsing/parseRouteFile.js";
import { logger } from "../util/logger.js";
import { validateRouteFiles } from "../validation/validateRouteFiles.js";
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

    const warnings: string[] = [];

    const routes = parseRouteFiles(config, warnings);

    const errors = validateRouteFiles(routes);

    if (errors.length > 0) {
      console.error("\nValidation errors found in route files:");
      console.error("-----------------------------------------");
      errors.forEach((error) => console.error(`- ${error}`));
      console.error("\n");
    }

    if (warnings.length > 0) {
      console.warn("\nWarnings found while parsing route files:");
      console.warn("---------------------------------------");
      warnings.forEach((warning) => console.warn(`- ${warning}`));
      console.warn("\n");
    }

    if (errors.length > 0) {
      console.error("Aborting generation due to validation errors.\n");
      return process.exit(1);
    }

    generateOutput(routes, config);

    logger(routes);

  }
  catch (error) {
    console.error("Error loading config:", error);
    process.exit(1);
  }
}