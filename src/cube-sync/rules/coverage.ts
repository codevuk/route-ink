import { columnMatchesSql, extractOwnColumnReferences } from "../parsing/normalize.js";
import type { CubeDefinition, CubeFile, CubeSyncExceptions, PrismaColumn, PrismaModelTable, PrismaRelation, Violation } from "../types.js";
import { isColumnExcepted, isJoinExcepted, isTableExcepted } from "../yaml/exceptions.js";

const collectSqlFields = (cube: CubeDefinition): Array<{ name: string; kind: "dimension" | "measure"; sql: string }> => {
  return [
    ...cube.dimensions.flatMap((dimension) => (
      dimension.sql ? [{ name: dimension.name, kind: "dimension" as const, sql: dimension.sql }] : []
    )),
    ...cube.measures.flatMap((measure) => (
      measure.sql ? [{ name: measure.name, kind: "measure" as const, sql: measure.sql }] : []
    )),
  ];
};

export const applyCoverageRule = (
  models: PrismaModelTable[],
  columns: PrismaColumn[],
  relations: PrismaRelation[],
  cubeFiles: CubeFile[],
  exceptions: CubeSyncExceptions,
): Violation[] => {
  const violations: Violation[] = [];
  const cubes = cubeFiles.flatMap((file) => file.cubes);
  const cubesByTable = new Map(cubes.map((cube) => [cube.normalizedTable, cube]));
  const modelsByTable = new Map(models.map((model) => [model.table, model]));
  const columnsByTable = new Map<string, PrismaColumn[]>();

  for (const column of columns) {
    const tableColumns = columnsByTable.get(column.table) ?? [];
    tableColumns.push(column);
    columnsByTable.set(column.table, tableColumns);
  }

  for (const model of models) {
    if (!cubesByTable.has(model.table) && !isTableExcepted(exceptions, model.table)) {
      violations.push({
        rule: "coverage",
        message: `${model.modelName} (${model.table}) — missing cube yaml with matching sql_table`,
      });
    }
  }

  for (const cube of cubes) {
    if (!modelsByTable.has(cube.normalizedTable) && !isTableExcepted(exceptions, cube.normalizedTable)) {
      violations.push({
        rule: "coverage",
        message: `${cube.name} (${cube.sqlTable}) — orphaned cube sql_table has no matching Prisma model`,
      });
    }
  }

  for (const [table, tableColumns] of columnsByTable) {
    const cube = cubesByTable.get(table);

    if (!cube) {
      continue;
    }

    const sqlFields = collectSqlFields(cube);

    for (const column of tableColumns) {
      if (isColumnExcepted(exceptions, table, column.column)) {
        continue;
      }

      const hasReference = sqlFields.some((field) => columnMatchesSql(field.sql, column.column));

      if (!hasReference) {
        violations.push({
          rule: "coverage",
          message: `${cube.name}.${column.column} — missing dimension or measure reference for ${column.modelName}.${column.fieldName}`,
        });
      }
    }
  }

  for (const cube of cubes) {
    const knownColumns = new Set((columnsByTable.get(cube.normalizedTable) ?? []).map((column) => column.column));

    if (knownColumns.size === 0) {
      continue;
    }

    for (const field of collectSqlFields(cube)) {
      for (const reference of extractOwnColumnReferences(field.sql, knownColumns)) {
        if (knownColumns.has(reference) || isColumnExcepted(exceptions, cube.normalizedTable, reference)) {
          continue;
        }

        violations.push({
          rule: "coverage",
          message: `${cube.name}.${field.name} — orphaned ${field.kind} sql reference '${reference}' is not a Prisma column`,
        });
      }
    }
  }

  for (const relation of relations) {
    if (isJoinExcepted(exceptions, relation.fromTable, relation.toTable)) {
      continue;
    }

    const fromCube = cubesByTable.get(relation.fromTable);
    const toCube = cubesByTable.get(relation.toTable);

    if (!fromCube || !toCube) {
      continue;
    }

    const hasJoin = fromCube.joins.some((join) => join.name === toCube.name)
      || toCube.joins.some((join) => join.name === fromCube.name);

    if (!hasJoin) {
      violations.push({
        rule: "coverage",
        message: `${relation.fromModel} -> ${relation.toModel} (${relation.relationName}) — missing joins entry in ${fromCube.name} or ${toCube.name}`,
      });
    }
  }

  return violations;
};
