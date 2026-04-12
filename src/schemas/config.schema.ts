import z from "zod/v4";

export const ConfigSchema = z.object({
  routesDir: z.string().default("../api/src/routes"),
  outputDir: z.string().min(1),
  name: z.string().default("api-client"),
  schemaPackage: z.string().default("@workspace/schemas"),
});

export type Config = z.infer<typeof ConfigSchema>;