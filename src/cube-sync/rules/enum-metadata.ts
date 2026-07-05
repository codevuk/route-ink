import type { CubeSyncMode } from "../config.schema.js";
import { columnMatchesSql } from "../parsing/normalize.js";
import type { CubeFile, PrismaColumn, Violation } from "../types.js";
import { refreshCubeFile } from "../yaml/cube-files.js";

const arraysEqual = (left: string[] | undefined, right: string[]): boolean => {
  return Boolean(left)
    && left?.length === right.length
    && left.every((value, index) => value === right[index]);
};

export const applyEnumMetadataRule = (
  columns: PrismaColumn[],
  cubeFiles: CubeFile[],
  mode: CubeSyncMode,
): Violation[] => {
  const violations: Violation[] = [];
  const cubesByTable = new Map(
    cubeFiles.flatMap((file) => file.cubes.map((cube) => [cube.normalizedTable, { cube, file }])),
  );

  for (const column of columns) {
    if (column.kind !== "enum" || !column.enumValues) {
      continue;
    }

    const cubeEntry = cubesByTable.get(column.table);

    if (!cubeEntry) {
      continue;
    }

    const dimension = cubeEntry.cube.dimensions.find((candidate) => (
      candidate.sql ? columnMatchesSql(candidate.sql, column.column) : false
    ));

    if (!dimension) {
      continue;
    }

    if (arraysEqual(dimension.metaEnum, column.enumValues)) {
      continue;
    }

    violations.push({
      rule: "enum",
      message: `${cubeEntry.cube.name}.${dimension.name} — expected meta.enum [${column.enumValues.join(", ")}] for ${column.modelName}.${column.fieldName}`,
    });

    if (mode === "fix") {
      cubeEntry.file.doc.setIn([...dimension.path, "meta", "enum"], column.enumValues);
      cubeEntry.file.changed = true;
      refreshCubeFile(cubeEntry.file);
    }
  }

  return violations;
};
