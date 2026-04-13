import { describe, expect, it } from "vitest";
import { derivePrefix } from "../../parsing/derivePrefix.js";

describe("derivePrefix", () => {
  it("index.route.ts → /", () => {
    expect(derivePrefix("index.route.ts")).toBe("/");
  });

  it("auth.route.ts → /auth", () => {
    expect(derivePrefix("auth.route.ts")).toBe("/auth");
  });

  it("customers/index.route.ts → /customers", () => {
    expect(derivePrefix("customers/index.route.ts")).toBe("/customers");
  });

  it("customers/groups.route.ts → /customers/groups", () => {
    expect(derivePrefix("customers/groups.route.ts")).toBe("/customers/groups");
  });

  it("api/v1/users/index.route.ts → /api/v1/users", () => {
    expect(derivePrefix("api/v1/users/index.route.ts")).toBe("/api/v1/users");
  });

  it("deeply nested non-index file → /a/b/c", () => {
    expect(derivePrefix("a/b/c.route.ts")).toBe("/a/b/c");
  });

  it("single segment non-index → /users", () => {
    expect(derivePrefix("users.route.ts")).toBe("/users");
  });

  it("three-level nested index → /api/v2/tasks", () => {
    expect(derivePrefix("api/v2/tasks/index.route.ts")).toBe("/api/v2/tasks");
  });
});
