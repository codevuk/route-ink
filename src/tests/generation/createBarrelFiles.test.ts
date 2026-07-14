import fs from "fs";
import os from "os";
import path from "path";
import type { SourceFile } from "ts-morph";
import { describe, expect, it } from "vitest";
import { buildBarrelFileContents } from "../../generation/createBarrelFiles.js";
import { createEndpointFiles } from "../../generation/createEndpointFiles.js";
import { getRouteNestingLevel, getRouteOutputDirectory } from "../../generation/util/getRouteOutputDirectory.js";
import type { Config } from "../../schemas/config.schema.js";
import type { Endpoint } from "../../types/Endpoint.js";
import type { RouteFile } from "../../types/RouteFile.js";

function makeRouteFile(relativePath: string, endpoints: Partial<Endpoint>[]): RouteFile {
  return {
    fullPath: `/routes/${relativePath}`,
    relativePath,
    route: "/",
    sourceFile: null as unknown as SourceFile,
    schemaImports: [],
    endpoints: endpoints.map((endpoint) => ({
      method: "GET",
      path: "/test",
      operationId: "DefaultOperation",
      schemaImports: [],
      response: {},
      ...endpoint,
    })),
  };
}

describe("getRouteOutputDirectory", () => {
  it("places index.route.ts hooks at the endpoints root", () => {
    expect(getRouteOutputDirectory("index.route.ts")).toBe("");
  });

  it("collapses nested index.route.ts files to their parent folder", () => {
    expect(getRouteOutputDirectory("customers/index.route.ts")).toBe("customers");
  });

  it("keeps non-index route files in their own folder", () => {
    expect(getRouteOutputDirectory("customers/orders.route.ts")).toBe("customers/orders");
  });
});

describe("getRouteNestingLevel", () => {
  it("uses a single parent hop for root-level route files", () => {
    expect(getRouteNestingLevel("index.route.ts")).toBe(1);
  });

  it("uses deeper nesting for nested route files", () => {
    expect(getRouteNestingLevel("customers/orders.route.ts")).toBe(3);
  });
});

describe("buildBarrelFileContents", () => {
  const routes = [
    makeRouteFile("index.route.ts", [{ operationId: "GetHealth" }]),
    makeRouteFile("users.route.ts", [
      { operationId: "GetUsers" },
      { method: "POST", operationId: "CreateUser" },
    ]),
    makeRouteFile("customers/orders.route.ts", [
      { operationId: "GetCustomerOrders" },
      { method: "POST", operationId: "CreateCustomerOrder" },
    ]),
  ];

  it("creates stable top-level query and mutation barrels with direct exports", () => {
    const barrelFiles = buildBarrelFileContents(routes);

    expect(barrelFiles["queries.ts"]).toContain('export { useGetHealthSuspenseQuery } from "./endpoints/GetHealth";');
    expect(barrelFiles["queries.ts"]).toContain('export { useGetUsersSuspenseQuery } from "./endpoints/users/GetUsers";');
    expect(barrelFiles["queries.ts"]).toContain('export { useGetCustomerOrdersSuspenseQuery } from "./endpoints/customers/orders/GetCustomerOrders";');
    expect(barrelFiles["mutations.ts"]).toContain('export { useCreateUserMutation } from "./endpoints/users/CreateUser";');
    expect(barrelFiles["mutations.ts"]).toContain('export { useCreateCustomerOrderMutation } from "./endpoints/customers/orders/CreateCustomerOrder";');
    expect(barrelFiles["queries.ts"]).not.toContain("export *");
    expect(barrelFiles["mutations.ts"]).not.toContain("export *");
  });

  it("creates flat endpoint barrels for nested directories", () => {
    const barrelFiles = buildBarrelFileContents(routes);

    expect(barrelFiles["endpoints/index.ts"]).toContain('export { useGetHealthSuspenseQuery } from "./GetHealth";');
    expect(barrelFiles["endpoints/index.ts"]).toContain('export { useCreateCustomerOrderMutation } from "./customers/orders/CreateCustomerOrder";');
    expect(barrelFiles["endpoints/customers/index.ts"]).toContain('export { useGetCustomerOrdersSuspenseQuery } from "./orders/GetCustomerOrders";');
    expect(barrelFiles["endpoints/customers/index.ts"]).toContain('export { useCreateCustomerOrderMutation } from "./orders/CreateCustomerOrder";');
    expect(barrelFiles["endpoints/customers/index.ts"]).not.toContain("export *");
  });

  it("creates a root index barrel with direct hook exports", () => {
    const barrelFiles = buildBarrelFileContents(routes);

    expect(barrelFiles["index.ts"]).toContain('export { useGetHealthSuspenseQuery } from "./endpoints/GetHealth";');
    expect(barrelFiles["index.ts"]).toContain('export { useCreateUserMutation } from "./endpoints/users/CreateUser";');
    expect(barrelFiles["index.ts"]).toContain('export * from "./util";');
  });
});

describe("createEndpointFiles", () => {
  it("writes stable top-level barrels and places root index.route.ts hooks at endpoints root", () => {
    const tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "route-ink-"));
    const config: Config = {
      routesDir: "/routes",
      outputDir: tempOutputDir,
      name: "api-client",
      schemaPackage: "@workspace/schemas",
      exportQueryOptions: false,
    };

    const routes = [
      makeRouteFile("index.route.ts", [{ operationId: "GetHealth", schemaImports: ["HealthSchema"], response: { 200: "HealthSchema" } }]),
      makeRouteFile("users.route.ts", [{ method: "POST", operationId: "CreateUser", schemaImports: ["UserSchema"], response: { 201: "UserSchema" } }]),
    ];

    try {
      createEndpointFiles(routes, config);

      const outputRoot = path.join(tempOutputDir, "api-client");
      const rootHookPath = path.join(outputRoot, "endpoints", "GetHealth.ts");
      const oldRootHookPath = path.join(outputRoot, "endpoints", "index", "GetHealth.ts");
      const queriesBarrelPath = path.join(outputRoot, "queries.ts");
      const mutationsBarrelPath = path.join(outputRoot, "mutations.ts");
      const endpointsBarrelPath = path.join(outputRoot, "endpoints", "index.ts");

      expect(fs.existsSync(rootHookPath)).toBe(true);
      expect(fs.existsSync(oldRootHookPath)).toBe(false);
      expect(fs.existsSync(queriesBarrelPath)).toBe(true);
      expect(fs.existsSync(mutationsBarrelPath)).toBe(true);
      expect(fs.existsSync(endpointsBarrelPath)).toBe(true);

      expect(fs.readFileSync(queriesBarrelPath, "utf-8")).toContain('export { useGetHealthSuspenseQuery } from "./endpoints/GetHealth";');
      expect(fs.readFileSync(mutationsBarrelPath, "utf-8")).toContain('export { useCreateUserMutation } from "./endpoints/users/CreateUser";');
      expect(fs.readFileSync(rootHookPath, "utf-8")).toContain('from "../util"');
    }
    finally {
      fs.rmSync(tempOutputDir, { recursive: true, force: true });
    }
  });
});