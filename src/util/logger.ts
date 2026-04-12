import type { RouteFile } from "../types/RouteFile.js";

export const logger = (routes: RouteFile[]) => {
  console.log("\nFound route files:");

  for (const route of routes) {
    console.log(`${route.relativePath} -> ${route.route}`);
    console.log(` - ${route.schemaImports.join(", ")}`);

    for (const endpoint of route.endpoints) {
      console.log(`   - ${endpoint.method} ${endpoint.operationId}`);
    }
  }

  console.log("------------------------------\n");
}