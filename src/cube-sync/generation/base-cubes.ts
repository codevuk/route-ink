import type { DMMF } from "@prisma/generator-helper";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import YAML from "yaml";
import type { CubeSyncConfig, CubeSyncMode } from "../config.schema.js";
import type { Violation } from "../types.js";
import { normalizeTableName } from "../parsing/normalize.js";

type GeneratedDimension = {
  name: string;
  sql: string;
  type: "number" | "string" | "time" | "boolean";
  primary_key?: true;
  description?: string;
  public?: boolean | string;
  meta?: {
    enum?: string[];
    ai_context?: string;
  };
};

type GeneratedJoin = {
  name: string;
  sql: string;
  relationship: "many_to_one" | "one_to_many" | "one_to_one";
};

type GeneratedRelationship = {
  cube: string;
  type: GeneratedJoin["relationship"];
};

type GeneratedCube = {
  name: string;
  sql_table: string;
  data_source: "default";
  public: false;
  description?: string;
  meta?: {
    ai_context?: string;
    relationships?: GeneratedRelationship[];
  };
  joins?: GeneratedJoin[];
  dimensions: GeneratedDimension[];
  measures: Array<{
    name: "count";
    type: "count";
    description: string;
    public: true;
  }>;
};

type BaseCubeGenerationResult = {
  changedFileCount: number;
  violations: Violation[];
};

type CubeAnnotation = {
  name?: string;
  description?: string;
  aiContext?: string;
  public?: boolean | string;
};

const getModelTable = (model: DMMF.Model): string => normalizeTableName(model.dbName ?? model.name);

const getFieldColumn = (field: DMMF.Field): string => field.dbName ?? field.name;

const toSnakeCase = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
};

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

const parseCubeAnnotation = (documentation: string | undefined): CubeAnnotation => {
  const annotation: CubeAnnotation = {};
  const descriptions: string[] = [];
  const aiContexts: string[] = [];

  for (const line of documentation?.split("\n") ?? []) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@cube.name ")) {
      annotation.name = trimmed.slice("@cube.name ".length).trim();
    }
    else if (trimmed.startsWith("@cube.description ")) {
      descriptions.push(trimmed.slice("@cube.description ".length).trim());
    }
    else if (trimmed.startsWith("@cube.ai_context ")) {
      aiContexts.push(trimmed.slice("@cube.ai_context ".length).trim());
    }
    else if (trimmed === "@cube.public false") {
      annotation.public = false;
    }
    else if (trimmed === "@cube.public true") {
      annotation.public = true;
    }
    else if (trimmed === "@cube.visibility pii_export") {
      annotation.public = "{{ COMPILE_CONTEXT.securityContext.role == 'pii_export' }}";
    }
  }

  return {
    ...annotation,
    ...(descriptions.length > 0 ? { description: descriptions.join(" ") } : {}),
    ...(aiContexts.length > 0 ? { aiContext: aiContexts.join(" ") } : {}),
  };
};

const getDocumentationDescription = (
  documentation: string | undefined,
  annotation: CubeAnnotation,
): string | undefined => {
  if (annotation.description) {
    return annotation.description;
  }

  const description = documentation
    ?.split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("@cube."))
    .join(" ");

  return description || undefined;
};

const getEnumValuesByName = (dmmf: DMMF.Document): Map<string, string[]> => {
  return new Map(
    dmmf.datamodel.enums.map((prismaEnum) => [
      prismaEnum.name,
      prismaEnum.values.map((value) => value.name),
    ]),
  );
};

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

const buildRelationJoins = (dmmf: DMMF.Document): Map<string, GeneratedJoin[]> => {
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

const buildGeneratedCube = (
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

const stringifyGeneratedCube = (cube: GeneratedCube): string => {
  return YAML.stringify({ cubes: [cube] }, { lineWidth: 0 });
};

export const generateBaseCubes = (
  dmmf: DMMF.Document,
  generatedCubeModelDir: string | undefined,
  mode: CubeSyncMode,
  config: CubeSyncConfig,
): BaseCubeGenerationResult => {
  if (!generatedCubeModelDir) {
    return { changedFileCount: 0, violations: [] };
  }

  const joinsByModel = buildRelationJoins(dmmf);
  const violations: Violation[] = [];
  let changedFileCount = 0;

  if (mode === "fix" && !existsSync(generatedCubeModelDir)) {
    mkdirSync(generatedCubeModelDir, { recursive: true });
  }

  for (const model of dmmf.datamodel.models) {
    const table = getModelTable(model);
    const filePath = join(generatedCubeModelDir, `${table}${config.generatedCubeNameSuffix}.yml`);
    const cube = buildGeneratedCube(model, dmmf, config, joinsByModel.get(model.name) ?? []);
    const expectedSource = stringifyGeneratedCube(cube);
    const currentSource = existsSync(filePath) ? readFileSync(filePath, "utf8") : undefined;

    if (currentSource === expectedSource) {
      continue;
    }

    if (mode === "fix") {
      writeFileSync(filePath, expectedSource);
      changedFileCount += 1;
    }
    else {
      violations.push({
        rule: "generated-base",
        message: `${table}${config.generatedCubeNameSuffix}.yml is missing or out of date`,
      });
    }
  }

  return { changedFileCount, violations };
};
