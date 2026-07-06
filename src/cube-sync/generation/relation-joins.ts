import type { DMMF } from "@prisma/generator-helper";
import { getFieldColumn, getModelTable, toSnakeCase } from "./prisma-helpers.js";
import type { GeneratedJoin } from "./types.js";

const getUniqueFieldSets = (model: DMMF.Model): ReadonlyArray<ReadonlyArray<string>> => {
  const idFields = model.fields.filter((field) => field.isId).map((field) => field.name);
  const uniqueFields = model.fields.filter((field) => field.isUnique).map((field) => [field.name]);
  return [
    ...(idFields.length > 0 ? [idFields] : []),
    ...uniqueFields,
    ...(model.uniqueFields ?? []),
  ];
};

const isUniqueRelation = (model: DMMF.Model, fieldNames: ReadonlyArray<string>): boolean => {
  const uniqueFieldSets = getUniqueFieldSets(model);
  return uniqueFieldSets.some((uniqueFieldSet) => (
    uniqueFieldSet.length === fieldNames.length
    && uniqueFieldSet.every((fieldName) => fieldNames.includes(fieldName))
  ));
};

export const buildRelationJoins = (dmmf: DMMF.Document): Map<string, GeneratedJoin[]> => {
  const modelByName = new Map(dmmf.datamodel.models.map((model) => [model.name, model]));
  const joinsByModel = new Map<string, GeneratedJoin[]>();
  const joinNameCountsByModel = new Map<string, Map<string, number>>();
  const candidates: Array<{ modelName: string; join: GeneratedJoin }> = [];

  for (const model of dmmf.datamodel.models) {
    for (const field of model.fields) {
      if (field.kind !== "object" || !field.relationFromFields?.length || !field.relationToFields?.length) {
        continue;
      }

      const targetModel = modelByName.get(field.type);
      if (!targetModel) {
        continue;
      }

      const localColumns = field.relationFromFields.map((fieldName) => {
        const localField = model.fields.find((modelField) => modelField.name === fieldName);
        return localField ? getFieldColumn(localField) : toSnakeCase(fieldName);
      });
      const targetColumns = field.relationToFields.map((fieldName) => {
        const targetField = targetModel.fields.find((modelField) => modelField.name === fieldName);
        return targetField ? getFieldColumn(targetField) : toSnakeCase(fieldName);
      });
      const sourceTable = getModelTable(model);
      const targetTable = getModelTable(targetModel);
      const sql = localColumns
        .map((column, index) => `{CUBE}.${column} = {${targetTable}.${targetColumns[index] ?? "id"}}`)
        .join(" AND ");
      const inverseSql = localColumns
        .map((column, index) => `{CUBE}.${targetColumns[index] ?? "id"} = {${sourceTable}.${column}}`)
        .join(" AND ");
      const inverseRelationship = isUniqueRelation(model, field.relationFromFields) ? "one_to_one" : "one_to_many";

      candidates.push({
        modelName: model.name,
        join: {
          name: targetTable,
          sql,
          relationship: "many_to_one",
        },
      });
      candidates.push({
        modelName: targetModel.name,
        join: {
          name: sourceTable,
          sql: inverseSql,
          relationship: inverseRelationship,
        },
      });
    }
  }

  for (const candidate of candidates) {
    const counts = joinNameCountsByModel.get(candidate.modelName) ?? new Map<string, number>();
    counts.set(candidate.join.name, (counts.get(candidate.join.name) ?? 0) + 1);
    joinNameCountsByModel.set(candidate.modelName, counts);
  }

  for (const candidate of candidates) {
    const counts = joinNameCountsByModel.get(candidate.modelName);
    if ((counts?.get(candidate.join.name) ?? 0) > 1) {
      continue;
    }

    const joins = joinsByModel.get(candidate.modelName) ?? [];
    joins.push(candidate.join);
    joinsByModel.set(candidate.modelName, joins);
  }

  return joinsByModel;
};
