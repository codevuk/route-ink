import type { DMMF } from "@prisma/generator-helper";
import type { PrismaConfig } from "../prisma-config.schema.js";
import type { PrismaEnum, PrismaModel } from "../types/PrismaModel.js";
import { mapPrismaTypeToZod } from "./mapPrismaTypeToZod.js";

export const parseEnums = (dmmf: DMMF.Document): PrismaEnum[] => {
  return dmmf.datamodel.enums.map((e) => ({
    name: e.name,
    values: e.values.map((v) => v.name),
  }));
};

export const parseModels = (dmmf: DMMF.Document, config: PrismaConfig): PrismaModel[] => {
  return dmmf.datamodel.models.map((model) => {
    const includedFields = model.fields.filter(
      (f) => f.kind === "scalar" || f.kind === "enum",
    );

    const enumImports = Array.from(
      new Set(includedFields.filter((f) => f.kind === "enum").map((f) => f.type)),
    );

    return {
      name: model.name,
      fields: includedFields.map((f) => ({
        name: f.name,
        zodExpression: mapPrismaTypeToZod(f, config),
      })),
      enumImports,
    };
  });
};
