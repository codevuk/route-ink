import type { GeneratorOptions } from "@prisma/generator-helper";
import { existsSync, statSync } from "fs";
import { dirname, isAbsolute, resolve } from "path";
import { CubeSyncConfigSchema } from "../config.schema.js";
import { generateBaseCubes } from "../generation/base-cubes.js";
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

  const resolvedSchemaPath = resolve(schemaPath ?? process.cwd());
  const schemaDir = existsSync(resolvedSchemaPath) && statSync(resolvedSchemaPath).isDirectory()
    ? resolvedSchemaPath
    : dirname(resolvedSchemaPath);

  return resolve(schemaDir, value);
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

  const config = configResult.data;
  const cubeModelDir = resolveFromSchema(options.schemaPath, config.cubeModelDir);
  const generatedCubeModelDir = config.generatedCubeModelDir
    ? resolveFromSchema(options.schemaPath, config.generatedCubeModelDir)
    : undefined;
  const exceptionsFile = config.exceptionsFile
    ? resolveFromSchema(options.schemaPath, config.exceptionsFile)
    : undefined;

  const cubeFiles = readCubeFiles(cubeModelDir);
  const exceptions = readExceptionsFile(exceptionsFile);
  const models = parsePrismaModelTables(options.dmmf);
  const columns = parsePrismaColumns(options.dmmf);
  const relations = parsePrismaRelations(options.dmmf);
  const generatedBaseResult = generateBaseCubes(options.dmmf, generatedCubeModelDir, config);
  const generatedCubeFiles = generatedCubeModelDir && existsSync(generatedCubeModelDir)
    ? readCubeFiles(generatedCubeModelDir)
    : [];

  const violations: Violation[] = [
    ...applyEnumMetadataRule(columns, cubeFiles),
    ...applyRelationshipMetadataRule(cubeFiles),
    ...applyCoverageRule(models, columns, relations, cubeFiles, exceptions, generatedCubeFiles),
  ];
  const changedFileCount = writeChangedCubeFiles(cubeFiles);

  printCubeSyncReport(violations, changedFileCount, generatedBaseResult.changedFileCount);
};
