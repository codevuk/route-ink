import fs from "node:fs";
import path from "node:path";
import type { PrismaConfig } from "../prisma-config.schema.js";
import type { PrismaEnum, PrismaModel } from "../types/PrismaModel.js";
import { expandNamingPattern } from "../util/expandNamingPattern.js";

const stripTsExtension = (fileName: string): string => fileName.replace(/\.ts$/, "");

const renderEnumFile = (e: PrismaEnum, config: PrismaConfig): string => {
  const schemaName = expandNamingPattern(config.enumSchemaNaming, e.name, "enum");
  const typeName = `${e.name}Type`;
  const valueLines = e.values.map((v) => `  "${v}",`).join("\n");

  return `import { z } from "zod/v4";

export const ${schemaName} = z.enum([
${valueLines}
]);

export type ${typeName} = z.output<typeof ${schemaName}>;
`;
};

const renderModelFile = (model: PrismaModel, config: PrismaConfig): string => {
  const schemaName = expandNamingPattern(config.modelSchemaNaming, model.name, "model");
  const typeName = `${model.name}Type`;
  const scalarFieldsName = `${model.name}ScalarFieldsSchema`;

  const enumImportLines = model.enumImports
    .slice()
    .sort()
    .map((enumName) => {
      const enumSchemaName = expandNamingPattern(config.enumSchemaNaming, enumName, "enum");
      const fileName = stripTsExtension(
        expandNamingPattern(config.enumFileNamingStyle, enumName, "enum"),
      );

      return `import { ${enumSchemaName} } from "./${fileName}";`;
    });

  const importBlock = ['import { z } from "zod/v4";', ...enumImportLines].join("\n");

  const objectBody = model.fields.length === 0
    ? "z.object({})"
    : `z.object({\n${model.fields.map((f) => `  ${f.name}: ${f.zodExpression},`).join("\n")}\n})`;

  const scalarFieldsBlock = model.fields.length === 0
    ? "// No scalar fields"
    : `export const ${scalarFieldsName} = z.enum([\n${model.fields.map((f) => `  "${f.name}",`).join("\n")}\n]);`;

  return `${importBlock}

export const ${schemaName} = ${objectBody};

${scalarFieldsBlock}

export type ${typeName} = z.output<typeof ${schemaName}>;
`;
};

const renderBarrel = (
  enums: PrismaEnum[],
  models: PrismaModel[],
  config: PrismaConfig,
): string => {
  const enumLines = enums
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => {
      const fileName = stripTsExtension(
        expandNamingPattern(config.enumFileNamingStyle, e.name, "enum"),
      );

      return `export * from "./${fileName}";`;
    });

  const modelLines = models
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => {
      const fileName = stripTsExtension(
        expandNamingPattern(config.modelFileNamingStyle, m.name, "model"),
      );

      return `export * from "./${fileName}";`;
    });

  const lines = [...enumLines, ...modelLines];

  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
};

export const createZodFiles = (
  models: PrismaModel[],
  enums: PrismaEnum[],
  outputDir: string,
  config: PrismaConfig,
): void => {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (const e of enums) {
    const fileName = expandNamingPattern(config.enumFileNamingStyle, e.name, "enum");
    fs.writeFileSync(path.join(outputDir, fileName), renderEnumFile(e, config), "utf-8");
  }

  for (const model of models) {
    const fileName = expandNamingPattern(config.modelFileNamingStyle, model.name, "model");
    fs.writeFileSync(path.join(outputDir, fileName), renderModelFile(model, config), "utf-8");
  }

  fs.writeFileSync(path.join(outputDir, "index.ts"), renderBarrel(enums, models, config), "utf-8");
};
