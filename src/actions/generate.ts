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

    console.log("Found route files:", routes);
  }
  catch (error) {
    console.error("Error loading config:", error);
    process.exit(1);
  }
}