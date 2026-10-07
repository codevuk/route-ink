import { resolve } from "node:path";
import z from "zod/v4";

export const ConfigSchema = z.object({
  routesDir: z.string().default("../api/src/routes"),
  // A single directory, or several when one API client serves multiple apps
  outputDir: z.union([
    z.string().min(1),
    z.array(z.string().min(1)).min(1),
  ]),
  name: z.string().default("api-client"),
  schemaPackage: z.string().default("@workspace/schemas"),
  exportQueryOptions: z.boolean().default(false),
}).superRefine((config, ctx) => {
  if (!Array.isArray(config.outputDir)) {
    return;
  }

  const seen = new Set<string>();

  config.outputDir.forEach((outputDir, index) => {
    const resolvedPath = resolve(outputDir);

    if (seen.has(resolvedPath)) {
      ctx.addIssue({
        code: "custom",
        path: ["outputDir", index],
        message: `Duplicate output directory: ${outputDir}`,
      });
    }

    seen.add(resolvedPath);
  });
});

export type Config = z.infer<typeof ConfigSchema>;

export const getOutputDirs = (config: Pick<Config, "outputDir">): string[] => Array.isArray(config.outputDir)
  ? config.outputDir
  : [config.outputDir];
