import { HealthSchema } from "@workspace/schemas";

export default async function (fastify: any) {
  // Root health check with a schema - should be parsed
  fastify.get("/", {
    schema: {
      operationId: "GetHealth",
      response: {
        200: HealthSchema,
      },
    },
  }, async () => {
    return { status: "ok" };
  });

  // Handler-only form with no options object - should be silently skipped
  fastify.get("/ping", async () => "pong");
}
