import { describe, expect, it } from "vitest";
import { validateRouteFiles } from "../../validation/validateRouteFiles.js";
import type { Endpoint } from "../../types/Endpoint.js";
import type { RouteFile } from "../../types/RouteFile.js";
import type { SourceFile } from "ts-morph";

function makeRouteFile(relativePath: string, endpoints: Partial<Endpoint>[]): RouteFile {
  return {
    fullPath: `/routes/${relativePath}`,
    relativePath,
    route: `/${relativePath.replace(".route.ts", "")}`,
    sourceFile: null as unknown as SourceFile,
    schemaImports: [],
    endpoints: endpoints.map((e) => ({
      method: "GET",
      path: "/test",
      operationId: "DefaultOp",
      schemaImports: [],
      response: {},
      ...e,
    })),
  };
}

describe("validateRouteFiles", () => {
  // ─── Happy path ───────────────────────────────────────────────────────────

  it("returns no errors for valid route files", () => {
    const files = [
      makeRouteFile("users.route.ts", [
        { operationId: "GetUsers" },
        { operationId: "CreateUser" },
      ]),
      makeRouteFile("orders.route.ts", [
        { operationId: "GetOrders" },
      ]),
    ];

    expect(validateRouteFiles(files)).toEqual([]);
  });

  it("returns no errors for an empty list of route files", () => {
    expect(validateRouteFiles([])).toEqual([]);
  });

  it("returns no errors for a file with no endpoints", () => {
    const files = [makeRouteFile("users.route.ts", [])];
    expect(validateRouteFiles(files)).toEqual([]);
  });

  // ─── Duplicate operationIds ───────────────────────────────────────────────

  it("reports an error for duplicate operationId in the same file", () => {
    const files = [
      makeRouteFile("users.route.ts", [
        { operationId: "GetUsers" },
        { operationId: "GetUsers" }, // duplicate
      ]),
    ];

    const errors = validateRouteFiles(files);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("GetUsers");
    expect(errors[0]).toMatch(/duplicate/i);
  });

  it("reports an error for duplicate operationId across different files", () => {
    const files = [
      makeRouteFile("users.route.ts", [{ operationId: "GetItems" }]),
      makeRouteFile("orders.route.ts", [{ operationId: "GetItems" }]), // duplicate
    ];

    const errors = validateRouteFiles(files);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("GetItems");
  });

  it("identifies which file contains the duplicate operationId", () => {
    const files = [
      makeRouteFile("users.route.ts", [{ operationId: "CreateItem" }]),
      makeRouteFile("orders.route.ts", [{ operationId: "CreateItem" }]),
    ];

    const errors = validateRouteFiles(files);
    expect(errors[0]).toContain("orders.route.ts");
  });

  it("reports multiple duplicate errors when several operationIds are duplicated", () => {
    const files = [
      makeRouteFile("a.route.ts", [
        { operationId: "OpA" },
        { operationId: "OpB" },
      ]),
      makeRouteFile("b.route.ts", [
        { operationId: "OpA" }, // duplicate
        { operationId: "OpB" }, // duplicate
      ]),
    ];

    const errors = validateRouteFiles(files);
    expect(errors).toHaveLength(2);
  });

  // ─── Invalid operationId format ───────────────────────────────────────────

  it("reports an error for an operationId starting with a lowercase letter", () => {
    const files = [
      makeRouteFile("users.route.ts", [{ operationId: "getUsers" }]),
    ];

    const errors = validateRouteFiles(files);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("getUsers");
    expect(errors[0]).toMatch(/uppercase/i);
  });

  it("accepts operationIds starting with an uppercase letter", () => {
    const files = [
      makeRouteFile("users.route.ts", [{ operationId: "GetUsers" }]),
    ];

    expect(validateRouteFiles(files)).toEqual([]);
  });

  it("reports an error for an operationId with a hyphen", () => {
    const files = [
      makeRouteFile("users.route.ts", [{ operationId: "Get-Users" }]),
    ];

    const errors = validateRouteFiles(files);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Get-Users");
  });

  it("reports an error for an operationId with a space", () => {
    const files = [
      makeRouteFile("users.route.ts", [{ operationId: "Get Users" }]),
    ];

    const errors = validateRouteFiles(files);
    expect(errors).toHaveLength(1);
  });

  it("accepts operationIds with underscores", () => {
    const files = [
      makeRouteFile("users.route.ts", [{ operationId: "Get_Users_V2" }]),
    ];

    expect(validateRouteFiles(files)).toEqual([]);
  });

  it("accepts operationIds with numbers", () => {
    const files = [
      makeRouteFile("users.route.ts", [{ operationId: "GetUsersV2" }]),
    ];

    expect(validateRouteFiles(files)).toEqual([]);
  });

  // ─── Multiple errors at once ──────────────────────────────────────────────

  it("reports both a format error and a duplicate error together", () => {
    const files = [
      makeRouteFile("a.route.ts", [{ operationId: "getUsers" }]), // lowercase start
      makeRouteFile("b.route.ts", [{ operationId: "getUsers" }]), // lowercase start + duplicate
    ];

    const errors = validateRouteFiles(files);
    // one format error for a.route.ts, one duplicate error for b.route.ts (plus potentially another format error)
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
