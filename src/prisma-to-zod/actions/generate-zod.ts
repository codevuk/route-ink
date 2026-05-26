import type { GeneratorOptions } from "@prisma/generator-helper";
import { createZodFiles } from "../generation/createZodFiles.js";
import { parseEnums, parseModels } from "../parsing/parseDmmf.js";
import { PrismaConfigSchema } from "../prisma-config.schema.js";

export const generateZod = async (options: GeneratorOptions): Promise<void> => {
  const outputDir = options.generator.output?.value;

  if (!outputDir) {
    throw new Error("Prisma generator block is missing `output`");
  }

  const configResult = PrismaConfigSchema.safeParse(options.generator.config);

  if (!configResult.success) {
    const issues = configResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new Error(`Invalid prisma-to-zod generator config: ${issues}`);
  }

  const config = configResult.data;

  const enums = parseEnums(options.dmmf);
  const models = parseModels(options.dmmf, config);

  const enumNames = new Set(enums.map((e) => e.name));

  for (const model of models) {
    if (enumNames.has(model.name)) {
      throw new Error(`Name collision: '${model.name}' is both a model and an enum`);
    }
  }

  if (enums.length === 0 && models.length === 0) {
    console.error("[prisma-to-zod] Warning: schema contains no models or enums; emitting empty barrel.");
  }

  createZodFiles(models, enums, outputDir, config);
};
