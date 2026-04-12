import type { Config } from "../schemas/config.schema.js";
import type { RouteFile } from "../types/RouteFile.js";
import { createUtilFiles } from "./createUtilFiles.js";

export const generateOutput = async (routes: RouteFile[], config: Config) => {
  try {
    createUtilFiles(config);
  }
  catch (error) {
    console.error("Error creating utility files:", error);
    process.exit(1);
  }
}