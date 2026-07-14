import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { getSchemaImports } from "../../parsing/getSchemaImports.js";
import type { Config } from "../../schemas/config.schema.js";

const baseConfig: Config = {
  routesDir: "../api/src/routes",
  outputDir: "./src/generated",
  name: "api-client",
  schemaPackage: "@workspace/schemas",
  exportQueryOptions: false,
};

function makeSourceFile(content: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile("test.route.ts", content);
}

describe("getSchemaImports", () => {
  it("returns named imports from the configured schemaPackage", () => {
    const sourceFile = makeSourceFile(`
      import { UserSchema, UserQuerySchema } from "@workspace/schemas";
    `);
    expect(getSchemaImports(sourceFile, baseConfig)).toEqual(
      expect.arrayContaining(["UserSchema", "UserQuerySchema"]),
    );
  });

  it("ignores imports from other packages", () => {
    const sourceFile = makeSourceFile(`
      import { UserSchema } from "@workspace/schemas";
      import { FastifyPluginAsync } from "fastify";
      import { z } from "zod/v4";
    `);
    const imports = getSchemaImports(sourceFile, baseConfig);
    expect(imports).toContain("UserSchema");
    expect(imports).not.toContain("FastifyPluginAsync");
    expect(imports).not.toContain("z");
  });

  it("returns an empty array when there are no imports from schemaPackage", () => {
    const sourceFile = makeSourceFile(`
      import { FastifyPluginAsync } from "fastify";
    `);
    expect(getSchemaImports(sourceFile, baseConfig)).toEqual([]);
  });

  it("returns an empty array for a file with no imports at all", () => {
    const sourceFile = makeSourceFile(`export default async function (fastify: any) {}`);
    expect(getSchemaImports(sourceFile, baseConfig)).toEqual([]);
  });

  it("uses the configured schemaPackage, not the default", () => {
    const customConfig: Config = { ...baseConfig, schemaPackage: "@my-org/api-types" };
    const sourceFile = makeSourceFile(`
      import { OrderSchema } from "@my-org/api-types";
      import { UserSchema } from "@workspace/schemas";
    `);
    const imports = getSchemaImports(sourceFile, customConfig);
    expect(imports).toContain("OrderSchema");
    expect(imports).not.toContain("UserSchema");
  });

  it("collects imports across multiple import declarations from the same package", () => {
    const sourceFile = makeSourceFile(`
      import { UserSchema } from "@workspace/schemas";
      import { OrderSchema, ProductSchema } from "@workspace/schemas";
    `);
    const imports = getSchemaImports(sourceFile, baseConfig);
    expect(imports).toEqual(expect.arrayContaining(["UserSchema", "OrderSchema", "ProductSchema"]));
    expect(imports).toHaveLength(3);
  });
});
