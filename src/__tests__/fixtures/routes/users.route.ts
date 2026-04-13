import { UserSchema, UserQuerySchema, CreateUserBodySchema, UpdateUserBodySchema, UserParamsSchema } from "@workspace/schemas";

export default async function (fastify: any) {
  // GET /users — query params, array response
  fastify.get("/", {
    schema: {
      operationId: "GetUsers",
      querystring: UserQuerySchema,
      response: {
        200: UserSchema.array(),
      },
    },
  }, async () => []);

  // GET /users/:id — URL params, single item response
  fastify.get("/:id", {
    schema: {
      operationId: "GetUser",
      params: UserParamsSchema,
      response: {
        200: UserSchema,
      },
    },
  }, async () => ({}));

  // POST /users — body + response
  fastify.post("/", {
    schema: {
      operationId: "CreateUser",
      body: CreateUserBodySchema,
      response: {
        201: UserSchema,
      },
    },
  }, async () => ({}));

  // PUT /users/:id — body + params
  fastify.put("/:id", {
    schema: {
      operationId: "UpdateUser",
      params: UserParamsSchema,
      body: UpdateUserBodySchema,
      response: {
        200: UserSchema,
      },
    },
  }, async () => ({}));

  // DELETE /users/:id — params only, no response body
  fastify.delete("/:id", {
    schema: {
      operationId: "DeleteUser",
      params: UserParamsSchema,
      response: {},
    },
  }, async () => null);
}
