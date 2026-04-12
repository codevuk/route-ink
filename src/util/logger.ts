import type { RouteFile } from "../types/RouteFile.js";

export const logger = (routes: RouteFile[]) => {
  console.log("Found route files:");

  for (const route of routes) {
    console.log(`- ${route.relativePath} -> ${route.route}`);
    console.log(`  Schema imports: ${route.schemaImports.join(", ")}`);
  }

}