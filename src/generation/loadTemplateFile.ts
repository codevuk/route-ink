import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const loadTemplateFile = (templateName: string): string => {
  // In dev: src/generation/util -> ../templates
  // In prod: dist/generation/util -> ../../templates
  const templatesDir = fs.existsSync(path.join(__dirname, "templates"))
    ? path.join(__dirname, "templates")
    : path.join(__dirname, "../templates");

  const templatePath = path.join(templatesDir, templateName);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templateName} (searched in ${templatesDir})`);
  }

  return fs.readFileSync(templatePath, "utf-8");
};