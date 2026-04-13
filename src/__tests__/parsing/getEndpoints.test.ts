import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { getEndpoints } from "../../parsing/getEndpoints.js";

// Default schema identifiers treated as available imports for all tests
const ALL_SCHEMAS = [
  "UserSchema",
  "UserQuerySchema",
  "UserParamsSchema",
  "CreateUserBodySchema",
  "UpdateUserBodySchema",
  "ErrorSchema",
];

type ParseOptions = {
  relativePath?: string;
  prefix?: string;
  availableImports?: string[];
};

function parse(
  content: string,
  {
    relativePath = "users.route.ts",
    prefix = "/users",
    availableImports = ALL_SCHEMAS,
  }: ParseOptions = {},
) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("test.route.ts", content);
  const warnings: string[] = [];
  const endpoints = getEndpoints(sourceFile, relativePath, prefix, availableImports, warnings);
  return { endpoints, warnings };
}

describe("getEndpoints", () => {
  // ─── Basic extraction ─────────────────────────────────────────────────────

  it("extracts method, path, and operationId from a GET route", () => {
    const { endpoints } = parse(`
      fastify.get('/', {
        schema: {
          operationId: 'GetUsers',
          response: { 200: UserSchema },
        },
      }, handler);
    `);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toMatchObject({
      method: "GET",
      path: "/users",
      operationId: "GetUsers",
    });
  });

  it("joins the file prefix with the route path", () => {
    const { endpoints } = parse(`
      fastify.get('/:id', {
        schema: {
          operationId: 'GetUser',
          response: { 200: UserSchema },
        },
      }, handler);
    `, { prefix: "/users" });

    expect(endpoints[0]?.path).toBe("/users/:id");
  });

  it("handles a root-level route path '/'", () => {
    const { endpoints } = parse(`
      fastify.get('/', {
        schema: {
          operationId: 'GetUsers',
          response: { 200: UserSchema },
        },
      }, handler);
    `, { prefix: "/users" });

    expect(endpoints[0]?.path).toBe("/users");
  });

  it("extracts querystring schema text", () => {
    const { endpoints } = parse(`
      fastify.get('/', {
        schema: {
          operationId: 'GetUsers',
          querystring: UserQuerySchema,
          response: { 200: UserSchema },
        },
      }, handler);
    `);

    expect(endpoints[0]?.query).toBe("UserQuerySchema");
  });

  it("extracts params schema text", () => {
    const { endpoints } = parse(`
      fastify.get('/:id', {
        schema: {
          operationId: 'GetUser',
          params: UserParamsSchema,
          response: { 200: UserSchema },
        },
      }, handler);
    `);

    expect(endpoints[0]?.params).toBe("UserParamsSchema");
  });

  it("extracts body schema text", () => {
    const { endpoints } = parse(`
      fastify.post('/', {
        schema: {
          operationId: 'CreateUser',
          body: CreateUserBodySchema,
          response: { 201: UserSchema },
        },
      }, handler);
    `);

    expect(endpoints[0]?.body).toBe("CreateUserBodySchema");
  });

  it("maps response status codes to schema expression strings", () => {
    const { endpoints } = parse(`
      fastify.get('/', {
        schema: {
          operationId: 'GetUsers',
          response: {
            200: UserSchema,
            404: ErrorSchema,
          },
        },
      }, handler);
    `);

    expect(endpoints[0]?.response).toEqual({ 200: "UserSchema", 404: "ErrorSchema" });
  });

  it("stores response schema as raw expression text (preserves method calls)", () => {
    const { endpoints } = parse(`
      fastify.get('/', {
        schema: {
          operationId: 'GetUsers',
          response: { 200: UserSchema.array() },
        },
      }, handler);
    `);

    expect(endpoints[0]?.response[200]).toBe("UserSchema.array()");
  });

  // ─── All HTTP methods ─────────────────────────────────────────────────────

  it.each([
    ["get", "GET"],
    ["post", "POST"],
    ["put", "PUT"],
    ["patch", "PATCH"],
    ["delete", "DELETE"],
  ])("fastify.%s → method %s", (lower, upper) => {
    const { endpoints } = parse(`
      fastify.${lower}('/', {
        schema: { operationId: 'DoSomething', response: {} },
      }, handler);
    `);

    expect(endpoints[0]?.method).toBe(upper);
  });

  // ─── Multiple routes in one file ──────────────────────────────────────────

  it("extracts all routes from a file with multiple fastify calls", () => {
    const { endpoints } = parse(`
      fastify.get('/', {
        schema: { operationId: 'GetUsers', response: { 200: UserSchema } },
      }, handler);

      fastify.post('/', {
        schema: { operationId: 'CreateUser', body: CreateUserBodySchema, response: { 201: UserSchema } },
      }, handler);

      fastify.delete('/:id', {
        schema: { operationId: 'DeleteUser', params: UserParamsSchema, response: {} },
      }, handler);
    `);

    expect(endpoints).toHaveLength(3);
    expect(endpoints.map((e) => e.method)).toEqual(["GET", "POST", "DELETE"]);
    expect(endpoints.map((e) => e.operationId)).toEqual(["GetUsers", "CreateUser", "DeleteUser"]);
  });

  // ─── Schema import collection ─────────────────────────────────────────────

  it("collects schema identifiers from all schema fields (params, body, response)", () => {
    const { endpoints } = parse(`
      fastify.put('/:id', {
        schema: {
          operationId: 'UpdateUser',
          params: UserParamsSchema,
          body: UpdateUserBodySchema,
          response: { 200: UserSchema },
        },
      }, handler);
    `);

    expect(endpoints[0]?.schemaImports).toEqual(
      expect.arrayContaining(["UserParamsSchema", "UpdateUserBodySchema", "UserSchema"]),
    );
  });

  it("only collects identifiers that are in availableImports", () => {
    const { endpoints } = parse(
      `
      fastify.get('/', {
        schema: {
          operationId: 'GetItems',
          response: { 200: UnknownSchema },
        },
      }, handler);
    `,
      { availableImports: ["UserSchema"] }, // UnknownSchema is NOT available
    );

    expect(endpoints[0]?.schemaImports).not.toContain("UnknownSchema");
    expect(endpoints[0]?.schemaImports).toHaveLength(0);
  });

  it("collects the base identifier from a complex expression like UserSchema.array()", () => {
    const { endpoints } = parse(`
      fastify.get('/', {
        schema: {
          operationId: 'GetUsers',
          response: { 200: UserSchema.array() },
        },
      }, handler);
    `);

    expect(endpoints[0]?.schemaImports).toContain("UserSchema");
  });

  it("collects the identifier inside a generic function call like PaginatedResponse(UserSchema)", () => {
    const { endpoints } = parse(`
      fastify.get('/', {
        schema: {
          operationId: 'GetUsers',
          response: { 200: PaginatedResponse(UserSchema) },
        },
      }, handler);
    `, { availableImports: ["UserSchema", "PaginatedResponse"] });

    expect(endpoints[0]?.schemaImports).toContain("UserSchema");
    expect(endpoints[0]?.schemaImports).toContain("PaginatedResponse");
  });

  it("deduplicates schema identifiers appearing in multiple fields", () => {
    const { endpoints } = parse(`
      fastify.post('/', {
        schema: {
          operationId: 'CreateUser',
          body: UserSchema,
          response: { 201: UserSchema },
        },
      }, handler);
    `);

    const count = endpoints[0]?.schemaImports.filter((s) => s === "UserSchema").length;
    expect(count).toBe(1);
  });

  // ─── Silent skips (no warning) ────────────────────────────────────────────

  it("silently skips routes without a schema property", () => {
    const { endpoints, warnings } = parse(`
      fastify.get('/health', {}, handler);
    `);

    expect(endpoints).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("silently skips routes where the second argument is the handler (2-arg form)", () => {
    const { endpoints, warnings } = parse(`
      fastify.get('/ping', async (request, reply) => {
        reply.send('pong');
      });
    `);

    expect(endpoints).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("ignores calls on objects other than 'fastify'", () => {
    const { endpoints, warnings } = parse(`
      app.get('/', {
        schema: { operationId: 'GetUsers', response: { 200: UserSchema } },
      }, handler);

      router.post('/', {
        schema: { operationId: 'CreateUser', response: { 201: UserSchema } },
      }, handler);
    `);

    expect(endpoints).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  // ─── Warnings ────────────────────────────────────────────────────────────

  it("warns and skips a route missing operationId", () => {
    const { endpoints, warnings } = parse(`
      fastify.get('/', {
        schema: {
          response: { 200: UserSchema },
        },
      }, handler);
    `);

    expect(endpoints).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/operationId/i);
  });

  it("warns and skips when schema is not an object literal", () => {
    const { endpoints, warnings } = parse(`
      const mySchema = {};
      fastify.get('/', {
        schema: mySchema,
      }, handler);
    `);

    expect(endpoints).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it("warns and skips when options argument is neither an object nor a function", () => {
    const { endpoints, warnings } = parse(`
      const opts = buildOpts();
      fastify.get('/', opts, handler);
    `);

    expect(endpoints).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it("accumulates multiple warnings from a single file", () => {
    const { warnings } = parse(`
      fastify.get('/', {
        schema: {
          response: { 200: UserSchema },
        },
      }, handler);

      fastify.post('/items', {
        schema: {
          response: { 201: UserSchema },
        },
      }, handler);
    `);

    expect(warnings).toHaveLength(2);
  });

  // ─── Nested handler calls ────────────────────────────────────────────────
  //
  // isInsideHandlerFunction intends to skip calls nested inside a handler, but
  // its guard checks whether ArrowFunction.getParent() is a SyntaxList node.
  // In ts-morph, an ArrowFunction passed as an argument has the CallExpression
  // as its direct parent — not a SyntaxList — so the guard never fires.
  // Both the outer route and the inner call are therefore parsed.

  it("parses both the outer route and a fastify call nested inside its arrow-function handler", () => {
    const { endpoints } = parse(`
      fastify.post('/trigger', {
        schema: { operationId: 'TriggerAction', response: { 200: UserSchema } },
      }, async (request, reply) => {
        fastify.get('/nested', {
          schema: { operationId: 'InnerGet', response: { 200: UserSchema } },
        }, innerHandler);
      });
    `, { prefix: "/actions" });

    expect(endpoints).toHaveLength(2);
    expect(endpoints.map((e) => e.operationId)).toContain("TriggerAction");
    expect(endpoints.map((e) => e.operationId)).toContain("InnerGet");
  });
});
