import z from "zod/v4";

export const CubeSyncConfigSchema = z.object({
  generatedCubeModelDir: z.string(),
  generatedCubeNameSuffix: z.string().default("_base"),
  generatedCubeSqlSchema: z.string().default("public"),
});

export type CubeSyncConfig = z.infer<typeof CubeSyncConfigSchema>;
