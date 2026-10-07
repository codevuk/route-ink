import fs from "fs";
import os from "os";
import path from "path";
import type { SourceFile } from "ts-morph";
import { describe, expect, it } from "vitest";
import { generateOutput } from "../../generation/generateOutput.js";
import type { Config } from "../../schemas/config.schema.js";
import type { RouteFile } from "../../types/RouteFile.js";

const routes: RouteFile[] = [{
  fullPath: "/routes/users.route.ts",
  relativePath: "users.route.ts",
  route: "/",
  sourceFile: null as unknown as SourceFile,
  schemaImports: [],
  endpoints: [{
    method: "GET",
    path: "/users",
    operationId: "GetUsers",
    schemaImports: ["UserSchema"],
    response: { 200: "UserSchema" },
  }],
}];

const makeConfig = (outputDir: Config["outputDir"]): Config => ({
  routesDir: "/routes",
  outputDir,
  name: "api-client",
  schemaPackage: "@workspace/schemas",
  exportQueryOptions: false,
});

describe("generateOutput", () => {
  it("generates into a single output directory", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "route-ink-"));

    try {
      const writtenPaths = await generateOutput(routes, makeConfig(tempDir));
      const outputRoot = path.join(tempDir, "api-client");

      expect(writtenPaths).toEqual([outputRoot]);
      expect(fs.existsSync(path.join(outputRoot, "endpoints", "users", "GetUsers.ts"))).toBe(true);
      expect(fs.existsSync(path.join(outputRoot, "util", "index.ts"))).toBe(true);
    }
    finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("generates identical clients into every output directory", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "route-ink-"));
    const webDir = path.join(tempDir, "apps", "web", "generated");
    const adminDir = path.join(tempDir, "apps", "admin", "generated");

    try {
      const writtenPaths = await generateOutput(routes, makeConfig([webDir, adminDir]));

      expect(writtenPaths).toEqual([path.join(webDir, "api-client"), path.join(adminDir, "api-client")]);

      const webHook = fs.readFileSync(path.join(webDir, "api-client", "endpoints", "users", "GetUsers.ts"), "utf-8");
      const adminHook = fs.readFileSync(path.join(adminDir, "api-client", "endpoints", "users", "GetUsers.ts"), "utf-8");

      expect(adminHook).toBe(webHook);
      expect(fs.existsSync(path.join(adminDir, "api-client", "index.ts"))).toBe(true);
      expect(fs.existsSync(path.join(adminDir, "api-client", "util", "index.ts"))).toBe(true);
    }
    finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
