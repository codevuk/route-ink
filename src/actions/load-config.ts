import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type Config, ConfigSchema } from "../schemas/config.schema.js";
import { to } from "../util/to.js";

type LoadConfigResult = {
  success: true;
  config: Config;
} | {
  success: false;
  error: string;
}

export const loadConfig = async (): Promise<LoadConfigResult> => {
  const configPath = resolve(process.cwd(), "routeink.json");

  // Read the config file
  const [error, fileContent] = await to(readFile(configPath, "utf-8"));

  if (error) {
    return {
      success: false,
      error: `Configuration file not found: ${configPath}`,
    };
  }

  const [parsingError, parsedData] = await to(JSON.parse(fileContent))

  if (parsingError) {
    return {
      success: false,
      error: `Ensure the configuration file is a valid JSON`,
    };
  }

  // Validate against schema
  const result = ConfigSchema.safeParse(parsedData);

  if (!result.success) {
    const errors = result.error.issues.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");

    return {
      success: false,
      error: `Invalid configuration: ${errors}`,
    };
  }

  return {
    success: true,
    config: result.data,
  };

}