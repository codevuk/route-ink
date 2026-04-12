import path from "path";
import { derivePrefix } from "../parsing/derivePrefix.js";
import { findRouteFiles } from "../parsing/findRouteFiles.js";
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

    const routes = findRouteFiles(config.routesDir);

    console.log("Found route files:");

    for (const routeFile of routes) {
      const relativePath = path.relative(config.routesDir, routeFile);

      const prefix = derivePrefix(relativePath);

      console.log(`- ${routeFile} → ${prefix}`);
    }

  }
  catch (error) {
    console.error("Error loading config:", error);
    process.exit(1);
  }
}