import type { DMMF } from "@prisma/generator-helper";
import YAML from "yaml";
import type { CubeSyncConfig } from "../config.schema.js";
import { getDocumentationDescription, parseCubeAnnotation } from "./annotations.js";
import { getFieldColumn, getModelTable } from "./prisma-helpers.js";
import type { CubeAnnotation, GeneratedCube, GeneratedDimension, GeneratedJoin } from "./types.js";

const reservedSqlIdentifiers = new Set(["order", "user"]);
const reservedCubeMemberNames = new Set(["sql"]);

const quoteSqlIdentifier = (identifier: string): string => {
  return /^[a-z_][a-z0-9_]*$/.test(identifier) && !reservedSqlIdentifiers.has(identifier)
    ? identifier
    : `"${identifier.replace(/"/g, "\"\"")}"`;
};

const getCubeMemberName = (column: string, annotation: CubeAnnotation): string => {
  if (annotation.name) {
    return annotation.name;
  }

  return reservedCubeMemberNames.has(column) ? `${column}_value` : column;
};

const getSqlTable = (model: DMMF.Model, config: CubeSyncConfig): string => {
  const table = getModelTable(model);
  const schema = config.generatedCubeSqlSchema;
  return schema ? `${quoteSqlIdentifier(schema)}.${quoteSqlIdentifier(table)}` : quoteSqlIdentifier(table);
};

const getDimensionType = (field: DMMF.Field): GeneratedDimension["type"] => {
  if (field.kind === "enum") {
    return "string";
  }

  switch (field.type) {
    case "Int":
    case "BigInt":
    case "Float":
    case "Decimal":
      return "number";
    case "DateTime":
      return "time";
    case "Boolean":
      return "boolean";
    default:
      return "string";
  }
};

const getEnumValuesByName = (dmmf: DMMF.Document): Map<string, string[]> => {
  return new Map(
    dmmf.datamodel.enums.map((prismaEnum) => [
      prismaEnum.name,
      prismaEnum.values.map((value) => value.name),
    ]),
  );
};

export const buildGeneratedCube = (
  model: DMMF.Model,
  dmmf: DMMF.Document,
  config: CubeSyncConfig,
  joins: GeneratedJoin[],
): GeneratedCube => {
  const enumValuesByName = getEnumValuesByName(dmmf);
  const table = getModelTable(model);
  const modelAnnotation = parseCubeAnnotation(model.documentation);
  const description = getDocumentationDescription(model.documentation, modelAnnotation);
  const relationships = joins.map((join) => ({
    cube: join.name,
    type: join.relationship,
  }));
  const dimensions = model.fields
    .filter((field) => field.kind === "scalar" || field.kind === "enum")
    .map((field) => {
      const annotation = parseCubeAnnotation(field.documentation);
      const enumValues = field.kind === "enum" ? enumValuesByName.get(field.type) ?? [] : undefined;
      const dimension: GeneratedDimension = {
        name: getCubeMemberName(getFieldColumn(field), annotation),
        sql: getFieldColumn(field),
        type: getDimensionType(field),
      };
      const description = getDocumentationDescription(field.documentation, annotation);

      if (field.isId) {
        dimension.primary_key = true;
      }
      if (description) {
        dimension.description = description;
      }
      dimension.public = annotation.public ?? true;
      if (enumValues || annotation.aiContext) {
        dimension.meta = {
          ...(enumValues ? { enum: enumValues } : {}),
          ...(annotation.aiContext ? { ai_context: annotation.aiContext } : {}),
        };
      }

      return dimension;
    });

  return {
    name: `${table}${config.generatedCubeNameSuffix}`,
    sql_table: getSqlTable(model, config),
    data_source: "default",
    public: false,
    ...(description ? { description } : {}),
    ...(modelAnnotation.aiContext || relationships.length > 0
      ? {
          meta: {
            ...(modelAnnotation.aiContext ? { ai_context: modelAnnotation.aiContext } : {}),
            ...(relationships.length > 0 ? { relationships } : {}),
          },
        }
      : {}),
    ...(joins.length > 0 ? { joins } : {}),
    dimensions,
    measures: [{
      name: "count",
      type: "count",
      description: `Total number of ${table} rows.`,
      public: true,
    }],
  };
};

export const stringifyGeneratedCube = (cube: GeneratedCube): string => {
  return YAML.stringify({ cubes: [cube] }, { lineWidth: 0 });
};
