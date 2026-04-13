import { OrderSchema, CreateOrderBodySchema, OrderParamsSchema } from "@workspace/schemas";

export default async function (fastify: any) {
  // GET /customers/orders
  fastify.get("/", {
    schema: {
      operationId: "GetCustomerOrders",
      response: {
        200: OrderSchema.array(),
      },
    },
  }, async () => []);

  // POST /customers/orders/:customerId — params + body
  fastify.post("/:customerId", {
    schema: {
      operationId: "CreateCustomerOrder",
      params: OrderParamsSchema,
      body: CreateOrderBodySchema,
      response: {
        201: OrderSchema,
      },
    },
  }, async () => ({}));

  // A route that should be silently skipped — no schema property
  fastify.get("/internal/ping", {}, async () => "pong");
}
