import { describe, expect, it } from "vitest";
import { joinPaths } from "../../parsing/util/joinPaths.js";

describe("joinPaths", () => {
  it("/tasks + / → /tasks", () => {
    expect(joinPaths("/tasks", "/")).toBe("/tasks");
  });

  it("/tasks + /:id → /tasks/:id", () => {
    expect(joinPaths("/tasks", "/:id")).toBe("/tasks/:id");
  });

  it("/ + /foo → /foo", () => {
    expect(joinPaths("/", "/foo")).toBe("/foo");
  });

  it("/ + / → /", () => {
    expect(joinPaths("/", "/")).toBe("/");
  });

  it("/users + /profile → /users/profile", () => {
    expect(joinPaths("/users", "/profile")).toBe("/users/profile");
  });

  it("strips trailing slash from prefix", () => {
    expect(joinPaths("/users/", "/profile")).toBe("/users/profile");
  });

  it("/api/v1 + /tasks → /api/v1/tasks", () => {
    expect(joinPaths("/api/v1", "/tasks")).toBe("/api/v1/tasks");
  });

  it("/customers + /:id/orders → /customers/:id/orders", () => {
    expect(joinPaths("/customers", "/:id/orders")).toBe("/customers/:id/orders");
  });
});
