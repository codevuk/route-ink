import type { RouteFile } from "../types/RouteFile.js";

export const logger = (routes: RouteFile[]) => {
  console.log("\nFound route files:");

  for (const route of routes) {
    console.log(`${route.relativePath} -> ${route.route}`);
    console.log(` - ${route.schemaImports.join(", ")}`);

    for (const endpoint of route.endpoints) {
      console.log(`   - ${endpoint.method} ${endpoint.path} ${endpoint.operationId}`);
      console.log(`     - query: ${endpoint.query}`);
      console.log(`     - params: ${endpoint.params}`);
      console.log(`     - body: ${endpoint.body}`);
      console.log(`     - response: ${JSON.stringify(endpoint.response)}`);
    }
  }

  console.log("------------------------------\n");
}