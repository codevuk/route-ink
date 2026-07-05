import type { GeneratorOptions } from "@prisma/generator-helper";
import { dirname, isAbsolute, resolve } from "path";
import { CubeSyncConfigSchema, CubeSyncModeSchema } from "../config.schema.js";
import { parsePrismaColumns, parsePrismaModelTables, parsePrismaRelations } from "../parsing/dmmf.js";
import { printCubeSyncReport } from "../reporting/printCubeSyncReport.js";
import { applyCoverageRule } from "../rules/coverage.js";
import { applyEnumMetadataRule } from "../rules/enum-metadata.js";
import { applyRelationshipMetadataRule } from "../rules/relationship-metadata.js";
import type { Violation } from "../types.js";
import { readCubeFiles, writeChangedCubeFiles } from "../yaml/cube-files.js";
import { readExceptionsFile } from "../yaml/exceptions.js";

const resolveFromSchema = (schemaPath: string | undefined, value: string): string => {
  if (isAbsolute(value)) {
    return value;
  }

  return resolve(dirname(schemaPath ?? process.cwd()), value);
};

const getMode = () => {
  const result = CubeSyncModeSchema.safeParse(process.env.ROUTE_INK_CUBE_SYNC_MODE ?? "fix");

  if (!result.success) {
    throw new Error("Invalid ROUTE_INK_CUBE_SYNC_MODE. Expected `check` or `fix`.");
  }

  return result.data;
};

export const generateCubeSync = async (options: GeneratorOptions): Promise<void> => {
  if (!options.generator.output?.value) {
    throw new Error("Prisma generator block is missing `output`");
  }

  const configResult = CubeSyncConfigSchema.safeParse(options.generator.config);

  if (!configResult.success) {
    const issues = configResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid cube-sync generator config: ${issues}`);
  }

  const mode = getMode();
  const config = configResult.data;
  const cubeModelDir = resolveFromSchema(options.schemaPath, config.cubeModelDir);
  const exceptionsFile = config.exceptionsFile
    ? resolveFromSchema(options.schemaPath, config.exceptionsFile)
    : undefined;

  const cubeFiles = readCubeFiles(cubeModelDir);
  const exceptions = readExceptionsFile(exceptionsFile);
  const models = parsePrismaModelTables(options.dmmf);
  const columns = parsePrismaColumns(options.dmmf);
  const relations = parsePrismaRelations(options.dmmf);

  const violations: Violation[] = [
    ...applyEnumMetadataRule(columns, cubeFiles, mode),
    ...applyRelationshipMetadataRule(cubeFiles, mode),
    ...applyCoverageRule(models, columns, relations, cubeFiles, exceptions),
  ];
  const changedFileCount = mode === "fix" ? writeChangedCubeFiles(cubeFiles) : 0;

  printCubeSyncReport(mode, violations, changedFileCount);

  if (mode === "check" && violations.length > 0) {
    throw new Error(`Cube schema sync check failed with ${violations.length} finding(s).`);
  }
};
