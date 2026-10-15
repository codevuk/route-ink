import { resolve } from "node:path";
import z from "zod/v4";

// An outputDir entry that overrides the top-level generation options for that
// directory. Strict so a typo (e.g. `hook: false`) fails loudly instead of
// silently emitting React code into a server-only app.
const OutputDirEntrySchema = z.object({
  dir: z.string().min(1),
  hooks: z.boolean().optional(),
  exportQueryOptions: z.boolean().optional(),
}).strict();

const OutputDirSchema = z.union([z.string().min(1), OutputDirEntrySchema]);

export const ConfigSchema = z.object({
  routesDir: z.string().default("../api/src/routes"),
  // A single directory, or several when one API client serves multiple apps
  outputDir: z.union([
    OutputDirSchema,
    z.array(OutputDirSchema).min(1),
  ]),
  name: z.string().default("api-client"),
  schemaPackage: z.string().default("@workspace/schemas"),
  hooks: z.boolean().default(true),
  exportQueryOptions: z.boolean().default(false),
}).superRefine((config, ctx) => {
  if (!Array.isArray(config.outputDir)) {
    return;
  }

  const seen = new Set<string>();

  config.outputDir.forEach((outputDir, index) => {
    const dir = typeof outputDir === "string" ? outputDir : outputDir.dir;
    const resolvedPath = resolve(dir);

    if (seen.has(resolvedPath)) {
      ctx.addIssue({
        code: "custom",
        path: ["outputDir", index],
        message: `Duplicate output directory: ${dir}`,
      });
    }

    seen.add(resolvedPath);
  });
});

export type Config = z.infer<typeof ConfigSchema>;

export type OutputDirEntry = z.infer<typeof OutputDirEntrySchema>;

/** The generation options in effect for a single output directory. */
export type OutputTarget = {
  dir: string;
  hooks: boolean;
  exportQueryOptions: boolean;
};

export type GenerationOptions = Pick<Config, "name" | "schemaPackage"> & Omit<OutputTarget, "dir">;

export const getOutputTargets = (config: Pick<Config, "outputDir" | "hooks" | "exportQueryOptions">): OutputTarget[] => {
  const entries = Array.isArray(config.outputDir)
    ? config.outputDir
    : [config.outputDir];

  return entries.map((entry) => typeof entry === "string"
    ? { dir: entry, hooks: config.hooks, exportQueryOptions: config.exportQueryOptions }
    : {
      dir: entry.dir,
      hooks: entry.hooks ?? config.hooks,
      exportQueryOptions: entry.exportQueryOptions ?? config.exportQueryOptions,
    });
};

export const getOutputDirs = (config: Pick<Config, "outputDir" | "hooks" | "exportQueryOptions">): string[] => getOutputTargets(config).map((target) => target.dir);
