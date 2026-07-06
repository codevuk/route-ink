import type { GeneratorOptions } from "@prisma/generator-helper";
import { existsSync, statSync } from "fs";
import { dirname, isAbsolute, resolve } from "path";
import { ANSI, color } from "../../actions/ui/ansi.js";
import { formatBadge } from "../../actions/ui/formatBadge.js";
import { CubeSyncConfigSchema } from "../config.schema.js";
import { generateBaseCubes } from "../generation/base-cubes.js";

const resolveFromSchema = (schemaPath: string | undefined, value: string): string => {
  if (isAbsolute(value)) {
    return value;
  }

  const resolvedSchemaPath = resolve(schemaPath ?? process.cwd());
  const schemaDir = existsSync(resolvedSchemaPath) && statSync(resolvedSchemaPath).isDirectory()
    ? resolvedSchemaPath
    : dirname(resolvedSchemaPath);

  return resolve(schemaDir, value);
};

export const generateCubeSync = async (options: GeneratorOptions): Promise<void> => {
  if (!options.generator.output?.value) {
    throw new Error("Prisma generator block is missing `output`");
  }

  const configResult = CubeSyncConfigSchema.safeParse(options.generator.config);

  if (!configResult.success) {
    const issues = configResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid cube-sync generator config: ${issues}`);
  }

  const config = configResult.data;
  const generatedCubeModelDir = resolveFromSchema(options.schemaPath, config.generatedCubeModelDir);
  const generatedBaseResult = generateBaseCubes(options.dmmf, generatedCubeModelDir, config);

  console.log(`\n${formatBadge("cube-sync", "success")}`);
  console.log(` generated base files: ${color(String(generatedBaseResult.changedFileCount), generatedBaseResult.changedFileCount > 0 ? ANSI.yellow : ANSI.green)}`);
};
