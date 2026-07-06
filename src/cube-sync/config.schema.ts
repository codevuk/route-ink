import z from "zod/v4";

export const CubeSyncConfigSchema = z.object({
  cubeModelDir: z.string(),
  exceptionsFile: z.string().optional(),
  generatedCubeModelDir: z.string().optional(),
  generatedCubeNameSuffix: z.string().default("_base"),
  generatedCubeSqlSchema: z.string().default("public"),
});

export type CubeSyncConfig = z.infer<typeof CubeSyncConfigSchema>;
