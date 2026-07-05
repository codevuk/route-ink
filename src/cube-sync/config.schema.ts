import z from "zod/v4";

export const CubeSyncConfigSchema = z.object({
  cubeModelDir: z.string(),
  exceptionsFile: z.string().optional(),
});

export type CubeSyncConfig = z.infer<typeof CubeSyncConfigSchema>;

export const CubeSyncModeSchema = z.enum(["check", "fix"]);

export type CubeSyncMode = z.infer<typeof CubeSyncModeSchema>;
