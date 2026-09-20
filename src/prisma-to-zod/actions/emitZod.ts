import { createZodFiles } from "../generation/createZodFiles.js";
import type { PrismaConfig } from "../prisma-config.schema.js";
import type { PrismaEnum, PrismaModel } from "../types/PrismaModel.js";

export const emitZod = (
  models: PrismaModel[],
  enums: PrismaEnum[],
  outputDir: string,
  config: PrismaConfig,
  source: string,
): void => {
  const enumNames = new Set(enums.map((e) => e.name));

  for (const model of models) {
    if (enumNames.has(model.name)) {
      throw new Error(`Name collision: '${model.name}' is both a model and an enum`);
    }
  }

  if (enums.length === 0 && models.length === 0) {
    console.error(`[prisma-to-zod] Warning: ${source} contains no models or enums; emitting empty barrel.`);
  }

  createZodFiles(models, enums, outputDir, config);
};
