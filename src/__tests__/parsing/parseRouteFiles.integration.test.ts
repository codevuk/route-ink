/**
 * Integration tests for parseRouteFiles.
 *
 * These tests run against the real fixture route files in src/__tests__/fixtures/routes/
 * and verify the full parsing pipeline: file discovery → AST analysis → Endpoint objects.
 *
 * Fixture structure:
 *   index.route.ts              → prefix /       (1 endpoint: GetHealth)
 *   users.route.ts              → prefix /users  (5 endpoints: GetUsers, GetUser, CreateUser, UpdateUser, DeleteUser)
 *   customers/index.route.ts    → prefix /customers       (1 endpoint: GetCustomers)
 *   customers/orders.route.ts   → prefix /customers/orders (2 endpoints: GetCustomerOrders, CreateCustomerOrder)
 */
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { parseRouteFiles } from "../../parsing/parseRouteFile.js";
import type { Config } from "../../schemas/config.schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = path.join(__dirname, "../fixtures/routes");

const config: Config = {
  routesDir: fixturesDir,
  outputDir: "./generated",
  name: "api-client",
  schemaPackage: "@workspace/schemas",
};

describe("parseRouteFiles (integration)", () => {
  // ─── File discovery ───────────────────────────────────────────────────────

  it("discovers all .route.ts files including nested directories", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);

    expect(routeFiles).toHaveLength(4);
  });

  it("discovers files in nested subdirectories (customers/)", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);

    const relPaths = routeFiles.map((rf) => rf.relativePath.replace(/\\/g, "/"));
    expect(relPaths).toContain("customers/index.route.ts");
    expect(relPaths).toContain("customers/orders.route.ts");
  });

  // ─── Prefix derivation from file path ────────────────────────────────────

  it("derives the correct route prefix for each file", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const prefixByRelPath: Record<string, string> = {};
    for (const rf of routeFiles) {
      prefixByRelPath[rf.relativePath.replace(/\\/g, "/")] = rf.route;
    }

    expect(prefixByRelPath["index.route.ts"]).toBe("/");
    expect(prefixByRelPath["users.route.ts"]).toBe("/users");
    expect(prefixByRelPath["customers/index.route.ts"]).toBe("/customers");
    expect(prefixByRelPath["customers/orders.route.ts"]).toBe("/customers/orders");
  });

  // ─── Endpoint counts ──────────────────────────────────────────────────────

  it("parses the correct number of endpoints from each file", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const endpointsByRelPath: Record<string, number> = {};
    for (const rf of routeFiles) {
      endpointsByRelPath[rf.relativePath.replace(/\\/g, "/")] = rf.endpoints.length;
    }

    expect(endpointsByRelPath["index.route.ts"]).toBe(1); // GetHealth only
    expect(endpointsByRelPath["users.route.ts"]).toBe(5); // GetUsers, GetUser, CreateUser, UpdateUser, DeleteUser
    expect(endpointsByRelPath["customers/index.route.ts"]).toBe(1); // GetCustomers
    expect(endpointsByRelPath["customers/orders.route.ts"]).toBe(2); // GetCustomerOrders, CreateCustomerOrder
  });

  // ─── Endpoint correctness ─────────────────────────────────────────────────

  it("parses the correct paths for users.route.ts endpoints", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const usersFile = routeFiles.find((rf) => rf.relativePath.replace(/\\/g, "/") === "users.route.ts")!;

    expect(usersFile).toBeDefined();
    const paths = usersFile.endpoints.map((e) => e.path);
    expect(paths).toContain("/users");
    expect(paths).toContain("/users/:id");
  });

  it("parses the correct methods for users.route.ts endpoints", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const usersFile = routeFiles.find((rf) => rf.relativePath.replace(/\\/g, "/") === "users.route.ts")!;

    const methods = usersFile.endpoints.map((e) => e.method);
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
    expect(methods).toContain("PUT");
    expect(methods).toContain("DELETE");
  });

  it("parses the correct operationIds for users.route.ts", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const usersFile = routeFiles.find((rf) => rf.relativePath.replace(/\\/g, "/") === "users.route.ts")!;

    const ids = usersFile.endpoints.map((e) => e.operationId);
    expect(ids).toEqual(expect.arrayContaining(["GetUsers", "GetUser", "CreateUser", "UpdateUser", "DeleteUser"]));
  });

  it("parses the correct operationIds for nested customers/orders.route.ts", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const ordersFile = routeFiles.find((rf) => rf.relativePath.replace(/\\/g, "/") === "customers/orders.route.ts")!;

    expect(ordersFile).toBeDefined();
    const ids = ordersFile.endpoints.map((e) => e.operationId);
    expect(ids).toEqual(expect.arrayContaining(["GetCustomerOrders", "CreateCustomerOrder"]));
  });

  it("builds full paths for nested routes by joining prefix and route path", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const ordersFile = routeFiles.find((rf) => rf.relativePath.replace(/\\/g, "/") === "customers/orders.route.ts")!;

    const createOrder = ordersFile.endpoints.find((e) => e.operationId === "CreateCustomerOrder")!;
    expect(createOrder.path).toBe("/customers/orders/:customerId");
  });

  // ─── Schema imports ───────────────────────────────────────────────────────

  it("collects schema imports from @workspace/schemas for each file", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const usersFile = routeFiles.find((rf) => rf.relativePath.replace(/\\/g, "/") === "users.route.ts")!;

    expect(usersFile.schemaImports).toContain("UserSchema");
    expect(usersFile.schemaImports).toContain("UserQuerySchema");
    expect(usersFile.schemaImports).toContain("CreateUserBodySchema");
  });

  it("associates schema identifiers with each endpoint", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const usersFile = routeFiles.find((rf) => rf.relativePath.replace(/\\/g, "/") === "users.route.ts")!;

    const createUser = usersFile.endpoints.find((e) => e.operationId === "CreateUser")!;
    expect(createUser.schemaImports).toContain("CreateUserBodySchema");
    expect(createUser.schemaImports).toContain("UserSchema");
  });

  // ─── Complex schemas ──────────────────────────────────────────────────────

  it("preserves method-call expressions in response schema (e.g. UserSchema.array())", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const usersFile = routeFiles.find((rf) => rf.relativePath.replace(/\\/g, "/") === "users.route.ts")!;

    const getUsers = usersFile.endpoints.find((e) => e.operationId === "GetUsers")!;
    expect(getUsers.response[200]).toBe("UserSchema.array()");
  });

  // ─── Silent skips ─────────────────────────────────────────────────────────

  it("silently skips the handler-only /ping route in index.route.ts (no warnings emitted)", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const indexFile = routeFiles.find((rf) => rf.relativePath.replace(/\\/g, "/") === "index.route.ts")!;

    // Only GetHealth should be parsed; /ping has no options object → silent skip
    expect(indexFile.endpoints).toHaveLength(1);
    expect(indexFile.endpoints[0]?.operationId).toBe("GetHealth");
    expect(warnings).toHaveLength(0);
  });

  it("silently skips routes with an empty options object (no schema) in customers/orders.route.ts", () => {
    const warnings: string[] = [];
    const routeFiles = parseRouteFiles(config, warnings);
    const ordersFile = routeFiles.find((rf) => rf.relativePath.replace(/\\/g, "/") === "customers/orders.route.ts")!;

    // /internal/ping has {} options (no schema) — silently skipped
    expect(ordersFile.endpoints).toHaveLength(2);
    expect(warnings).toHaveLength(0);
  });
});
