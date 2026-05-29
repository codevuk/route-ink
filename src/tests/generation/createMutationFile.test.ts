import { describe, expect, it } from "vitest";
import { createMutationFile } from "../../generation/createMutationFile.js";
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
    method: "POST",
    path: "/users",
    operationId: "CreateUser",
    schemaImports: ["UserSchema"],
    response: { 201: "UserSchema" },
    ...overrides,
  };
}

describe("createMutationFile", () => {
  // ─── Template selection ──────────────────────────────────────────────────────

  describe("mutation-basic (no body, no params)", () => {
    it("produces the correct output", () => {
      const result = createMutationFile(
        makeEndpoint({ response: { 201: "UserSchema" } }),
        baseConfig,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("uses void as the mutation input type", () => {
      const result = createMutationFile(
        makeEndpoint({ response: {} }),
        baseConfig,
        1,
      );
      expect(result).toContain("void");
    });

    it("imports QueryError from util", () => {
      const result = createMutationFile(makeEndpoint(), baseConfig, 1);
      expect(result).toContain("QueryError");
      expect(result).not.toContain("injectParams");
    });

    it("drops the unused zod import when there is no response schema", () => {
      const result = createMutationFile(
        makeEndpoint({ response: {}, schemaImports: [] }),
        baseConfig,
        1,
      );
      // z is never referenced (no response/body/params schema), so the import
      // must not be emitted — otherwise consumers hit an unused-import error.
      expect(result).not.toContain('import z from "zod/v4";');
      expect(result).not.toMatch(/\bz\./);
    });

    it("keeps the zod import when a response schema is present", () => {
      const result = createMutationFile(
        makeEndpoint({ response: { 201: "UserSchema" } }),
        baseConfig,
        1,
      );
      expect(result).toContain('import z from "zod/v4";');
    });

    it("drops the empty schema-package import when there are no schema imports", () => {
      const result = createMutationFile(
        makeEndpoint({ response: {}, schemaImports: [] }),
        baseConfig,
        1,
      );
      expect(result).not.toContain("@workspace/schemas");
      expect(result).not.toMatch(/import \{\s*\} from/);
    });
  });

  describe("mutation-with-body (body only)", () => {
    it("produces the correct output", () => {
      const result = createMutationFile(
        makeEndpoint({
          body: "CreateUserBodySchema",
          schemaImports: ["UserSchema", "CreateUserBodySchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("includes body input type", () => {
      const result = createMutationFile(
        makeEndpoint({
          body: "CreateUserBodySchema",
          schemaImports: ["UserSchema", "CreateUserBodySchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toContain("body: z.output<typeof CreateUserBodySchema>");
    });

    it("calls axios with the body argument", () => {
      const result = createMutationFile(
        makeEndpoint({
          body: "CreateUserBodySchema",
          schemaImports: ["UserSchema", "CreateUserBodySchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toContain("axios.post(url, body)");
    });
  });

  describe("mutation-with-params (params only)", () => {
    it("produces the correct output", () => {
      const result = createMutationFile(
        makeEndpoint({
          method: "DELETE",
          path: "/users/:id",
          operationId: "DeleteUser",
          params: "UserParamsSchema",
          schemaImports: ["UserParamsSchema"],
          response: {},
        }),
        baseConfig,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("imports injectParams from util", () => {
      const result = createMutationFile(
        makeEndpoint({ params: "UserParamsSchema", schemaImports: ["UserSchema", "UserParamsSchema"] }),
        baseConfig,
        1,
      );
      expect(result).toContain("injectParams");
    });

    it("includes params input type", () => {
      const result = createMutationFile(
        makeEndpoint({ params: "UserParamsSchema", schemaImports: ["UserSchema", "UserParamsSchema"] }),
        baseConfig,
        1,
      );
      expect(result).toContain("params: z.output<typeof UserParamsSchema>");
    });
  });

  describe("mutation-with-body-and-params", () => {
    it("produces the correct output", () => {
      const result = createMutationFile(
        makeEndpoint({
          method: "PUT",
          path: "/users/:id",
          operationId: "UpdateUser",
          body: "UpdateUserBodySchema",
          params: "UserParamsSchema",
          schemaImports: ["UserSchema", "UpdateUserBodySchema", "UserParamsSchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toMatchSnapshot();
    });

    it("includes both params and body input fields", () => {
      const result = createMutationFile(
        makeEndpoint({
          body: "UpdateUserBodySchema",
          params: "UserParamsSchema",
          schemaImports: ["UserSchema", "UpdateUserBodySchema", "UserParamsSchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toContain("params: z.output<typeof UserParamsSchema>");
      expect(result).toContain("body: z.output<typeof UpdateUserBodySchema>");
    });

    it("calls axios with urlWithParams and body", () => {
      const result = createMutationFile(
        makeEndpoint({
          body: "UpdateUserBodySchema",
          params: "UserParamsSchema",
          schemaImports: ["UserSchema", "UpdateUserBodySchema", "UserParamsSchema"],
        }),
        baseConfig,
        1,
      );
      expect(result).toContain("axios.post(urlWithParams, body)");
    });
  });

  // ─── DELETE never includes a body ────────────────────────────────────────────

  describe("DELETE body suppression", () => {
    it("DELETE with body specified falls back to mutation-basic (no body)", () => {
      const result = createMutationFile(
        makeEndpoint({
          method: "DELETE",
          body: "DeleteBodySchema",
          schemaImports: ["UserSchema", "DeleteBodySchema"],
        }),
        baseConfig,
        1,
      );
      // Should NOT include a MutationInput type with body
      expect(result).not.toContain("body: z.output");
      // Should use the basic template (void input)
      expect(result).toContain("void");
    });

    it("DELETE with body + params uses mutation-with-params (no body)", () => {
      const result = createMutationFile(
        makeEndpoint({
          method: "DELETE",
          path: "/users/:id",
          operationId: "DeleteUser",
          body: "DeleteBodySchema",
          params: "UserParamsSchema",
          schemaImports: ["UserParamsSchema", "DeleteBodySchema"],
          response: {},
        }),
        baseConfig,
        1,
      );
      expect(result).toContain("params: z.output<typeof UserParamsSchema>");
      expect(result).not.toContain("body: z.output");
    });

    it("DELETE without body or params uses mutation-basic", () => {
      const result = createMutationFile(
        makeEndpoint({
          method: "DELETE",
          path: "/users/:id",
          operationId: "DeleteUser",
          schemaImports: [],
          response: {},
        }),
        baseConfig,
        1,
      );
      expect(result).toContain("void");
      expect(result).not.toContain("body:");
      expect(result).not.toContain("params:");
    });
  });

  // ─── HTTP method variants ────────────────────────────────────────────────────

  it("PUT method uses axios.put", () => {
    const result = createMutationFile(
      makeEndpoint({ method: "PUT", body: "UpdateBodySchema", schemaImports: ["UserSchema", "UpdateBodySchema"] }),
      baseConfig,
      1,
    );
    expect(result).toContain("axios.put(url, body)");
  });

  it("PATCH method uses axios.patch", () => {
    const result = createMutationFile(
      makeEndpoint({ method: "PATCH", body: "PatchBodySchema", schemaImports: ["UserSchema", "PatchBodySchema"] }),
      baseConfig,
      1,
    );
    expect(result).toContain("axios.patch(url, body)");
  });

  it("DELETE method uses axios.delete", () => {
    const result = createMutationFile(
      makeEndpoint({ method: "DELETE", params: "UserParamsSchema", schemaImports: ["UserParamsSchema"], response: {} }),
      baseConfig,
      1,
    );
    expect(result).toContain("axios.delete(urlWithParams)");
  });

  // ─── Response schema handling ────────────────────────────────────────────────

  it("response present → mutation_response_type uses z.output<typeof ...>", () => {
    const result = createMutationFile(
      makeEndpoint({ response: { 200: "UserSchema" } }),
      baseConfig,
      1,
    );
    expect(result).toContain("z.output<typeof UserSchema>");
    expect(result).toContain("UserSchema.parse(response.data)");
  });

  it("no response schema → mutation_response_type is undefined", () => {
    const result = createMutationFile(
      makeEndpoint({ response: {}, schemaImports: [] }),
      baseConfig,
      1,
    );
    expect(result).toContain("UseMutationOptions<");
    expect(result).toContain("undefined");
    // Should NOT attempt to parse a non-existent schema
    expect(result).not.toContain(".parse(response.data)");
    expect(result).toContain("await axios.post(url)");
    expect(result).not.toContain("const response = await");
    expect(result).toContain("return undefined;");
  });

  it("complex response schema is wrapped in a const", () => {
    const result = createMutationFile(
      makeEndpoint({ response: { 200: "UserSchema.array()" } }),
      baseConfig,
      1,
    );
    expect(result).toContain("const ResponseSchema = UserSchema.array();");
    expect(result).toContain("ResponseSchema.parse(response.data)");
  });

  it("uses 200 response when available", () => {
    const result = createMutationFile(
      makeEndpoint({ response: { 200: "OkSchema", 201: "CreatedSchema" } }),
      baseConfig,
      1,
    );
    expect(result).toContain("OkSchema");
    expect(result).not.toContain("CreatedSchema");
  });

  it("falls back to 201 when 200 is absent", () => {
    const result = createMutationFile(
      makeEndpoint({ response: { 201: "CreatedSchema" } }),
      baseConfig,
      1,
    );
    expect(result).toContain("CreatedSchema");
  });

  it("falls back to 202 when 200 and 201 are absent", () => {
    const result = createMutationFile(
      makeEndpoint({ response: { 202: "AcceptedSchema" } }),
      baseConfig,
      1,
    );
    expect(result).toContain("AcceptedSchema");
  });

  it("falls back to 204 when 200–202 are absent", () => {
    const result = createMutationFile(
      makeEndpoint({ response: { 204: "NoContentSchema" } }),
      baseConfig,
      1,
    );
    expect(result).toContain("NoContentSchema");
  });

  // ─── Complex body / params schemas ──────────────────────────────────────────

  it("complex body schema is wrapped in a const", () => {
    const result = createMutationFile(
      makeEndpoint({ body: "z.object({name: z.string()})", schemaImports: ["UserSchema"] }),
      baseConfig,
      1,
    );
    expect(result).toContain("const BodySchema = z.object({name: z.string()});");
    expect(result).toContain("typeof BodySchema");
  });

  it("complex params schema is wrapped in a const", () => {
    const result = createMutationFile(
      makeEndpoint({ params: "z.object({id: z.string()})", schemaImports: ["UserSchema"] }),
      baseConfig,
      1,
    );
    expect(result).toContain("const ParamsSchema = z.object({id: z.string()});");
    expect(result).toContain("typeof ParamsSchema");
  });

  // ─── Nesting level / import path depth ──────────────────────────────────────

  it("nestingLevel 1 produces ../util import path", () => {
    const result = createMutationFile(makeEndpoint(), baseConfig, 1);
    expect(result).toContain("../util");
  });

  it("nestingLevel 2 produces ../../util import path (nested folder structure)", () => {
    const result = createMutationFile(makeEndpoint(), baseConfig, 2);
    expect(result).toContain("../../util");
  });

  // ─── Schema imports ──────────────────────────────────────────────────────────

  it("deduplicates schema imports", () => {
    const result = createMutationFile(
      makeEndpoint({ schemaImports: ["UserSchema", "UserSchema", "OtherSchema"] }),
      baseConfig,
      1,
    );
    const importMatch = result.match(/import \{([^}]+)\} from "@workspace\/schemas"/);
    expect(importMatch).not.toBeNull();
    const importList = importMatch![1]!;
    const occurrences = importList.split("UserSchema").length - 1;
    expect(occurrences).toBe(1);
  });

  it("respects a custom schemaPackage", () => {
    const customConfig: Config = { ...baseConfig, schemaPackage: "@my-org/api-types" };
    const result = createMutationFile(makeEndpoint(), customConfig, 1);
    expect(result).toContain('from "@my-org/api-types"');
  });

  // ─── queryKeyInvalidation ────────────────────────────────────────────────────

  it("generated mutation accepts a queryKeyInvalidation option", () => {
    const result = createMutationFile(makeEndpoint(), baseConfig, 1);
    expect(result).toContain("queryKeyInvalidation");
  });

  it("generated mutation invalidates queries on onSettled", () => {
    const result = createMutationFile(makeEndpoint(), baseConfig, 1);
    expect(result).toContain("invalidateQueries");
    expect(result).toContain("onSettled");
  });
});
