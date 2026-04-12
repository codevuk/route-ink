import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Config } from "../schemas/config.schema.js";
import { createBarrelFile } from "./util/createBarrelFile.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createUtilFiles = (config: Config) => {
  const { outputDir, name } = config;

  const fullOutputPath = `${outputDir}/${name}`;

  // Lets first clear out the output directory if it exists
  fs.rmSync(fullOutputPath, { recursive: true, force: true });
  fs.mkdirSync(fullOutputPath, { recursive: true });

  // Create util folder
  const utilPath = path.join(fullOutputPath, "util");
  fs.mkdirSync(utilPath, { recursive: true });

  // Copy template files
  // In dev: src/generation -> src/generation/templates/util
  // In prod: dist/generation -> dist/templates/util
  const templatesDir = fs.existsSync(path.join(__dirname, "templates/util"))
    ? path.join(__dirname, "templates/util")
    : path.join(__dirname, "../templates/util");

  const templateFiles = fs.readdirSync(templatesDir);

  for (const templateFile of templateFiles) {
    if (templateFile.endsWith(".template")) {
      const templatePath = path.join(templatesDir, templateFile);
      const content = fs.readFileSync(templatePath, "utf-8");

      // Remove .template extension
      const outputFileName = templateFile.replace(".template", "");
      const outputPath = path.join(utilPath, outputFileName);

      fs.writeFileSync(outputPath, content, "utf-8");
    }
  }

  createBarrelFile(utilPath);
}