import type { DMMF } from "@prisma/generator-helper";
import type { PrismaColumn, PrismaModelTable, PrismaRelation } from "../types.js";
import { normalizeTableName } from "./normalize.js";

const getModelTable = (model: DMMF.Model): string => normalizeTableName(model.dbName ?? model.name);

const getFieldColumn = (field: DMMF.Field): string => field.dbName ?? field.name;

export const parsePrismaModelTables = (dmmf: DMMF.Document): PrismaModelTable[] => {
  return dmmf.datamodel.models.map((model) => ({
    modelName: model.name,
    table: getModelTable(model),
  }));
};

export const parsePrismaColumns = (dmmf: DMMF.Document): PrismaColumn[] => {
  const enumValuesByName = new Map(
    dmmf.datamodel.enums.map((prismaEnum) => [
      prismaEnum.name,
      prismaEnum.values.map((value) => value.name),
    ]),
  );

  return dmmf.datamodel.models.flatMap((model) => {
    const table = getModelTable(model);

    return model.fields
      .filter((field) => field.kind === "scalar" || field.kind === "enum")
      .map((field) => ({
        modelName: model.name,
        table,
        fieldName: field.name,
        column: getFieldColumn(field),
        kind: field.kind as "scalar" | "enum",
        enumName: field.kind === "enum" ? field.type : undefined,
        enumValues: field.kind === "enum" ? enumValuesByName.get(field.type) ?? [] : undefined,
      }));
  });
};

export const parsePrismaRelations = (dmmf: DMMF.Document): PrismaRelation[] => {
  const modelByName = new Map(dmmf.datamodel.models.map((model) => [model.name, model]));
  const seen = new Set<string>();
  const relations: PrismaRelation[] = [];

  for (const model of dmmf.datamodel.models) {
    for (const field of model.fields) {
      if (field.kind !== "object") {
        continue;
      }

      const targetModel = modelByName.get(field.type);
      if (!targetModel) {
        continue;
      }

      const fromTable = getModelTable(model);
      const toTable = getModelTable(targetModel);
      const relationName = field.relationName ?? `${model.name}_${field.name}`;
      const key = [relationName, ...[fromTable, toTable].sort()].join("::");

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      relations.push({
        fromModel: model.name,
        fromTable,
        toModel: targetModel.name,
        toTable,
        relationName,
      });
    }
  }

  return relations;
};
