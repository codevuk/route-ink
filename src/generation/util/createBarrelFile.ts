import fs from "fs";
import path from "path";

/**
 * Creates a barrel file (index.ts) that exports all TypeScript files in the directory.
 * Only processes files at the top level (one level deep).
 * Also exports from directories if they contain an index.ts file.
 * 
 * @param dirPath - The directory path where the barrel file should be created
 * @returns The path to the created barrel file
 */
export const createBarrelFile = (dirPath: string): string => {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  const exports: string[] = [];

  for (const file of files) {
    if (file.isFile() && file.name.endsWith(".ts") && file.name !== "index.ts") {
      // Only process files (not directories) at this level
      // Remove .ts extension for the import
      const fileNameWithoutExt = file.name.replace(/\.ts$/, "");
      exports.push(`export * from "./${fileNameWithoutExt}";`);
    } else if (file.isDirectory()) {
      // Check if the directory has an index.ts file
      const indexPath = path.join(dirPath, file.name, "index.ts");
      if (fs.existsSync(indexPath)) {
        exports.push(`export * from "./${file.name}";`);
      }
    }
  }

  // Sort exports alphabetically for consistency
  exports.sort();

  const barrelContent = exports.join("\n") + "\n";
  const barrelPath = path.join(dirPath, "index.ts");

  fs.writeFileSync(barrelPath, barrelContent, "utf-8");

  return barrelPath;
};
