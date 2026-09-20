import type { GeneratorOptions } from "@prisma/generator-helper";
import { parseEnums, parseModels } from "../parsing/parseDmmf.js";
import { PrismaConfigSchema } from "../prisma-config.schema.js";
import { formatZodIssues } from "../util/formatZodIssues.js";
import { emitZod } from "./emitZod.js";

export const generateZod = async (options: GeneratorOptions): Promise<void> => {
  const outputDir = options.generator.output?.value;

  if (!outputDir) {
    throw new Error("Prisma generator block is missing `output`");
  }

  const configResult = PrismaConfigSchema.safeParse(options.generator.config);

  if (!configResult.success) {
    throw new Error(
      `Invalid prisma-to-zod generator config: ${formatZodIssues(configResult.error.issues)}`,
    );
  }

  const config = configResult.data;

  emitZod(
    parseModels(options.dmmf, config),
    parseEnums(options.dmmf),
    outputDir,
    config,
    "schema",
  );
};
