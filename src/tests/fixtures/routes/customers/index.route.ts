import { CustomerSchema, CustomerQuerySchema } from "@workspace/schemas";

export default async function (fastify: any) {
  // GET /customers — querystring + paginated response using a generic wrapper
  fastify.get("/", {
    schema: {
      operationId: "GetCustomers",
      querystring: CustomerQuerySchema,
      response: {
        200: CustomerSchema.array(),
      },
    },
  }, async () => []);
}
