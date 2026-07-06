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
  generatedCubeFiles: CubeFile[] = [],
): Violation[] => {
  const violations: Violation[] = [];
  const cubes = cubeFiles.flatMap((file) => file.cubes);
  const relationCubes = [...cubes, ...generatedCubeFiles.flatMap((file) => file.cubes)];
  const cubesByTable = new Map(cubes.map((cube) => [cube.normalizedTable, cube]));
  const relationCubesByTable = new Map<string, CubeDefinition[]>();
  const modelsByTable = new Map(models.map((model) => [model.table, model]));
  const columnsByTable = new Map<string, PrismaColumn[]>();

  for (const cube of relationCubes) {
    const tableCubes = relationCubesByTable.get(cube.normalizedTable) ?? [];
    tableCubes.push(cube);
    relationCubesByTable.set(cube.normalizedTable, tableCubes);
  }

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
    if (!cube.sqlTable) {
      continue;
    }

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

    if (!cube.sqlTable && cube.extendsCube) {
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

    const fromCubes = relationCubesByTable.get(relation.fromTable) ?? [];
    const toCubes = relationCubesByTable.get(relation.toTable) ?? [];

    if (fromCubes.length === 0 || toCubes.length === 0) {
      continue;
    }

    const fromCubeNames = new Set([relation.fromTable, ...fromCubes.map((cube) => cube.name)]);
    const toCubeNames = new Set([relation.toTable, ...toCubes.map((cube) => cube.name)]);
    const hasJoin = fromCubes.some((cube) => cube.joins.some((join) => toCubeNames.has(join.name)))
      || toCubes.some((cube) => cube.joins.some((join) => fromCubeNames.has(join.name)));

    if (!hasJoin) {
      violations.push({
        rule: "coverage",
        message: `${relation.fromModel} -> ${relation.toModel} (${relation.relationName}) — missing joins entry in ${relation.fromTable} or ${relation.toTable}`,
      });
    }
  }

  return violations;
};
