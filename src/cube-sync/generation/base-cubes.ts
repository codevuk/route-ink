import type { DMMF } from "@prisma/generator-helper";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { CubeSyncConfig } from "../config.schema.js";
import { buildGeneratedCube, stringifyGeneratedCube } from "./build-generated-cube.js";
import { getModelTable } from "./prisma-helpers.js";
import { buildRelationJoins } from "./relation-joins.js";
import type { BaseCubeGenerationResult } from "./types.js";

export const generateBaseCubes = (
  dmmf: DMMF.Document,
  generatedCubeModelDir: string,
  config: CubeSyncConfig,
): BaseCubeGenerationResult => {
  const joinsByModel = buildRelationJoins(dmmf);
  let changedFileCount = 0;

  if (!existsSync(generatedCubeModelDir)) {
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

    writeFileSync(filePath, expectedSource);
    changedFileCount += 1;
  }

  return { changedFileCount };
};
