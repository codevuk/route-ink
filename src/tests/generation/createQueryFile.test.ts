import { describe, expect, it } from "vitest";
import { createQueryFile } from "../../generation/createQueryFile.js";
import type { Config } from "../../schemas/config.schema.js";
import type { Endpoint } from "../../types/Endpoint.js";

const baseConfig: Config = {
  routesDir: "../api/src/routes",
  outputDir: "./src/generated",
  name: "api-client",
  schemaPackage: "@workspace/schemas",
};

function makeEndpoint(overrides: Partial<Endpoint> = {}): Endpoint {
  return {
    method: "GET",
    path: "/users",
    operationId: "GetUsers",
    schemaImports: ["UserSchema"],
    response: { 200: "UserSchema" },
    ...overrides,
  };
}

describe("createQueryFile", () => {
  // ─── Template selection ──────────────────────────────────────────────────────

  describe("get-basic (no params, no query)", () => {
    it("produces the correct output", () => {
      const result = createQueryFile(makeEndpoint(), baseConfig, 1);
      expect(result).toMatchSnapshot();
    });

    it("imports buildQueryKey from util", () => {
      const result = createQueryFile(makeEndpoint(), baseConfig, 1);
      expect(result).toContain("buildQueryKey");
      expect(result).not.toContain("injectParams");
      expect(result).not.toContain("serializeSearchQuery");
    });

    it("uses the operation id as the hook name", () => {
      const result = createQueryFile(makeEndpoint({ operationId: "ListOrders" }), baseConfig, 1);
      expect(result).toContain("useListOrdersSuspenseQuery");
    });
  });

  describe("get-with-query (query only)", () => {
    it("produces the correct output", () => {
      const result = createQueryFile(
        makeEndpoint({ query: "UserQuerySchema", schemaImports: ["UserSchema", "UserQuerySchema"] }),
        baseConfig,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("imports serializeSearchQuery from util", () => {
      const result = createQueryFile(
        makeEndpoint({ query: "UserQuerySchema", schemaImports: ["UserSchema", "UserQuerySchema"] }),
        baseConfig,
        1,
      );
      expect(result).toContain("serializeSearchQuery");
      expect(result).not.toContain("injectParams");
    });

    it("includes query input type with query field", () => {
      const result = createQueryFile(
        makeEndpoint({ query: "UserQuerySchema", schemaImports: ["UserSchema", "UserQuerySchema"] }),
        baseConfig,
        1,
      );
      expect(result).toContain("query: z.output<typeof UserQuerySchema>");
    });
  });

  describe("get-with-params (params only)", () => {
    it("produces the correct output", () => {
      const result = createQueryFile(
        makeEndpoint({
          path: "/users/:id",
          operationId: "GetUser",
          params: "UserParamsSchema",
          schemaImports: ["UserSchema", "UserParamsSchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("imports injectParams from util", () => {
      const result = createQueryFile(
        makeEndpoint({ params: "UserParamsSchema", schemaImports: ["UserSchema", "UserParamsSchema"] }),
        baseConfig,
        1,
      );
      expect(result).toContain("injectParams");
      expect(result).not.toContain("serializeSearchQuery");
    });

    it("includes params input type with params field", () => {
      const result = createQueryFile(
        makeEndpoint({ params: "UserParamsSchema", schemaImports: ["UserSchema", "UserParamsSchema"] }),
        baseConfig,
        1,
      );
      expect(result).toContain("params: z.output<typeof UserParamsSchema>");
    });
  });

  describe("get-with-query-and-params (both)", () => {
    it("produces the correct output", () => {
      const result = createQueryFile(
        makeEndpoint({
          path: "/users/:id/posts",
          operationId: "GetUserPosts",
          params: "UserParamsSchema",
          query: "PostQuerySchema",
          schemaImports: ["UserSchema", "UserParamsSchema", "PostQuerySchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("imports both injectParams and serializeSearchQuery", () => {
      const result = createQueryFile(
        makeEndpoint({
          params: "UserParamsSchema",
          query: "PostQuerySchema",
          schemaImports: ["UserSchema", "UserParamsSchema", "PostQuerySchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toContain("injectParams");
      expect(result).toContain("serializeSearchQuery");
    });

    it("input type has both params and query fields", () => {
      const result = createQueryFile(
        makeEndpoint({
          params: "UserParamsSchema",
          query: "PostQuerySchema",
          schemaImports: ["UserSchema", "UserParamsSchema", "PostQuerySchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toContain("params: z.output<typeof UserParamsSchema>");
      expect(result).toContain("query: z.output<typeof PostQuerySchema>");
    });
  });

  // ─── Complex schema handling ─────────────────────────────────────────────────

  describe("complex response schema", () => {
    it("wraps complex response schema in a const", () => {
      const result = createQueryFile(
        makeEndpoint({ response: { 200: "UserSchema.array()" } }),
        baseConfig,
        1,
      );
      expect(result).toContain("const ResponseSchema = UserSchema.array();");
      expect(result).toContain("ResponseSchema.parse(response.data)");
    });

    it("produces the correct output with complex response schema", () => {
      const result = createQueryFile(
        makeEndpoint({ response: { 200: "PaginatedResponse(UserSchema)" } }),
        baseConfig,
        1,
      );
      expect(result).toMatchSnapshot();
    });
  });

  describe("complex query schema", () => {
    it("wraps complex query schema in a const", () => {
      const result = createQueryFile(
        makeEndpoint({
          query: "z.object({search: z.string()}).optional()",
          schemaImports: ["UserSchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toContain("const QuerySchema = z.object({search: z.string()}).optional();");
      expect(result).toContain("typeof QuerySchema");
    });
  });

  describe("complex params schema", () => {
    it("wraps complex params schema in a const", () => {
      const result = createQueryFile(
        makeEndpoint({
          params: "z.object({id: z.string()})",
          schemaImports: ["UserSchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toContain("const ParamsSchema = z.object({id: z.string()});");
      expect(result).toContain("typeof ParamsSchema");
    });
  });

  // ─── Response status code priority ──────────────────────────────────────────

  it("uses 200 response schema when available", () => {
    const result = createQueryFile(
      makeEndpoint({ response: { 200: "OkSchema", 201: "CreatedSchema" } }),
      baseConfig,
      1,
    );
    expect(result).toContain("OkSchema");
    expect(result).not.toContain("CreatedSchema");
  });

  it("falls back to 201 when 200 is absent", () => {
    const result = createQueryFile(
      makeEndpoint({ response: { 201: "CreatedSchema" } }),
      baseConfig,
      1,
    );
    expect(result).toContain("CreatedSchema");
  });

  it("falls back to 204 when 200 and 201 are absent", () => {
    const result = createQueryFile(
      makeEndpoint({ response: { 204: "NoContentSchema" } }),
      baseConfig,
      1,
    );
    expect(result).toContain("NoContentSchema");
  });

  it("uses z.any() as fallback when no response schema is present", () => {
    const result = createQueryFile(makeEndpoint({ response: {} }), baseConfig, 1);
    expect(result).toContain("z.any()");
  });

  // ─── Nesting level / import path depth ──────────────────────────────────────

  it("nestingLevel 1 produces ../util import path", () => {
    const result = createQueryFile(makeEndpoint(), baseConfig, 1);
    expect(result).toContain("../util");
  });

  it("nestingLevel 2 produces ../../util import path (nested folder structure)", () => {
    const result = createQueryFile(makeEndpoint(), baseConfig, 2);
    expect(result).toContain("../../util");
  });

  it("nestingLevel 3 produces ../../../util import path", () => {
    const result = createQueryFile(makeEndpoint(), baseConfig, 3);
    expect(result).toContain("../../../util");
  });

  // ─── Schema imports ──────────────────────────────────────────────────────────

  it("deduplicates schema imports", () => {
    const result = createQueryFile(
      makeEndpoint({ schemaImports: ["UserSchema", "UserSchema", "OtherSchema"] }),
      baseConfig,
      1,
    );
    // Should appear exactly once in the import statement
    const importMatch = result.match(/import \{([^}]+)\} from "@workspace\/schemas"/);
    expect(importMatch).not.toBeNull();
    const importList = importMatch![1]!;
    const occurrences = importList.split("UserSchema").length - 1;
    expect(occurrences).toBe(1);
  });

  it("respects a custom schemaPackage", () => {
    const customConfig: Config = { ...baseConfig, schemaPackage: "@my-org/api-types" };
    const result = createQueryFile(makeEndpoint(), customConfig, 1);
    expect(result).toContain('from "@my-org/api-types"');
  });
});
