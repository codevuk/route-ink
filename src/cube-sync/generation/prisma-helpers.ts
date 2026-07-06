import type { DMMF } from "@prisma/generator-helper";
import { normalizeTableName } from "../parsing/normalize.js";

export const getModelTable = (model: DMMF.Model): string => normalizeTableName(model.dbName ?? model.name);

export const getFieldColumn = (field: DMMF.Field): string => field.dbName ?? field.name;

export const toSnakeCase = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
};
