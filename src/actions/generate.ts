import { loadConfig } from "./load-config.js";

export const generate = async () => {
  console.log("Generating API client...");
  // Lets first load the config
  try {
    const result = await loadConfig();

    if (!result.success) {
      console.error("Failed to load config:", result.error);
      process.exit(1);
    }

    console.log("Config loaded:", result.config);

  }
  catch (error) {
    console.error("Error loading config:", error);
    process.exit(1);
  }
}