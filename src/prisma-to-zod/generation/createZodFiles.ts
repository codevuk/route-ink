import fs from "node:fs";
import path from "node:path";
import type { PrismaConfig } from "../prisma-config.schema.js";
import type { PrismaEnum, PrismaModel } from "../types/PrismaModel.js";
import { expandNamingPattern } from "../util/expandNamingPattern.js";

const stripTsExtension = (fileName: string): string => fileName.replace(/\.ts$/, "");

const sameDir = (a: string, b: string): boolean => path.resolve(a) === path.resolve(b);

const isStrictDescendant = (parent: string, child: string): boolean => {
  if (sameDir(parent, child)) {
    return false;
  }

  const rel = path.relative(path.resolve(parent), path.resolve(child));

  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
};

const commonAncestorDir = (a: string, b: string): string => {
  const aParts = path.resolve(a).split(path.sep);
  const bParts = path.resolve(b).split(path.sep);
  const shared: string[] = [];

  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    if (aParts[i] === bParts[i]) {
      shared.push(aParts[i]!);
    }
    else {
      break;
    }
  }

  return shared.join(path.sep);
};

const toImportPath = (
  fromFile: string,
  toFile: string,
  importStyle: PrismaConfig["importStyle"],
): string => {
  let rel = path.relative(path.dirname(fromFile), toFile);

  if (path.sep === "\\") {
    rel = rel.replace(/\\/g, "/");
  }

  if (!rel.startsWith(".")) {
    rel = `./${rel}`;
  }

  rel = stripTsExtension(rel);

  if (importStyle === "esm") {
    rel += ".js";
  }

  return rel;
};

const enumFilePath = (enumName: string, enumDir: string, config: PrismaConfig): string => {
  const fileName = expandNamingPattern(config.enumFileNamingStyle, enumName, "enum");
  return path.join(enumDir, fileName);
};

const modelFilePath = (modelName: string, modelDir: string, config: PrismaConfig): string => {
  const fileName = expandNamingPattern(config.modelFileNamingStyle, modelName, "model");
  return path.join(modelDir, fileName);
};

const renderEnumFile = (e: PrismaEnum, config: PrismaConfig): string => {
  const schemaName = expandNamingPattern(config.enumSchemaNaming, e.name, "enum");
  const typeName = expandNamingPattern(config.enumTypeNaming, e.name, "enum");
  const valueLines = e.values.map((v) => `  "${v}",`).join("\n");

  return `import { z } from "zod/v4";

export const ${schemaName} = z.enum([
${valueLines}
]);

export type ${typeName} = z.output<typeof ${schemaName}>;
`;
};

const renderModelFile = (
  model: PrismaModel,
  modelFile: string,
  modelDir: string,
  enumDir: string,
  config: PrismaConfig,
): string => {
  const schemaName = expandNamingPattern(config.modelSchemaNaming, model.name, "model");
  const typeName = expandNamingPattern(config.modelTypeNaming, model.name, "model");
  const scalarFieldsName = `${model.name}ScalarFieldsSchema`;

  // Same-dir refs use the specific enum file (no barrel in play).
  // If the enum dir is an ancestor of the model dir, its barrel will re-export
  // the model sub-barrel — going through it would cycle, so use specific files.
  const useEnumBarrel = !sameDir(modelDir, enumDir) && !isStrictDescendant(enumDir, modelDir);

  const enumImportLines = model.enumImports
    .slice()
    .sort()
    .map((enumName) => {
      const enumSchemaName = expandNamingPattern(config.enumSchemaNaming, enumName, "enum");
      const target = useEnumBarrel
        ? path.join(enumDir, "index.ts")
        : enumFilePath(enumName, enumDir, config);
      const importPath = toImportPath(modelFile, target, config.importStyle);

      return `import { ${enumSchemaName} } from "${importPath}";`;
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
  barrelDir: string,
  enumsInDir: PrismaEnum[],
  modelsInDir: PrismaModel[],
  subBarrelDirs: string[],
  enumDir: string,
  modelDir: string,
  config: PrismaConfig,
): string => {
  const barrelFile = path.join(barrelDir, "index.ts");

  const subLines = subBarrelDirs.map((dir) => {
    const target = path.join(dir, "index.ts");
    return `export * from "${toImportPath(barrelFile, target, config.importStyle)}";`;
  });

  const enumLines = enumsInDir
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => {
      const target = enumFilePath(e.name, enumDir, config);
      return `export * from "${toImportPath(barrelFile, target, config.importStyle)}";`;
    });

  const modelLines = modelsInDir
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => {
      const target = modelFilePath(m.name, modelDir, config);
      return `export * from "${toImportPath(barrelFile, target, config.importStyle)}";`;
    });

  const lines = [...subLines, ...enumLines, ...modelLines];

  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
};

export const createZodFiles = (
  models: PrismaModel[],
  enums: PrismaEnum[],
  outputDir: string,
  config: PrismaConfig,
): void => {
  const modelDir = path.resolve(outputDir, config.modelOutputDir);
  const enumDir = path.resolve(outputDir, config.enumOutputDir);

  // Only touch directories that will actually contain generated files.
  // The Prisma `output` field is just an anchor for relative resolution —
  // we never create or write to it directly.
  const dirsToWipe = new Set<string>();

  if (models.length > 0) {
    dirsToWipe.add(modelDir);
  }

  if (enums.length > 0) {
    dirsToWipe.add(enumDir);
  }

  // Wipe before any mkdir so parent/child dir relationships don't clobber
  // freshly-created subdirs.
  for (const dir of dirsToWipe) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  for (const dir of dirsToWipe) {
    fs.mkdirSync(dir, { recursive: true });
  }

  for (const e of enums) {
    fs.writeFileSync(
      enumFilePath(e.name, enumDir, config),
      renderEnumFile(e, config),
      "utf-8",
    );
  }

  for (const model of models) {
    const file = modelFilePath(model.name, modelDir, config);
    fs.writeFileSync(
      file,
      renderModelFile(model, file, modelDir, enumDir, config),
      "utf-8",
    );
  }

  // Collect the set of directories that get a barrel:
  // - modelDir if there are models
  // - enumDir if there are enums
  // - the common ancestor of modelDir and enumDir, when `topLevelBarrel` is
  //   enabled and both kinds of files exist in separate locations
  const barrelDirs = new Set<string>();

  if (models.length > 0) {
    barrelDirs.add(modelDir);
  }

  if (enums.length > 0) {
    barrelDirs.add(enumDir);
  }

  const wantTopLevel = config.topLevelBarrel
    && !sameDir(modelDir, enumDir)
    && models.length > 0
    && enums.length > 0;

  if (wantTopLevel) {
    const common = commonAncestorDir(modelDir, enumDir);

    // Skip degenerate ancestors like the filesystem root.
    if (common && common !== path.sep && common.split(path.sep).filter(Boolean).length > 0) {
      barrelDirs.add(common);
      fs.mkdirSync(common, { recursive: true });
    }
  }

  for (const dir of barrelDirs) {
    const directEnums = sameDir(dir, enumDir) ? enums : [];
    const directModels = sameDir(dir, modelDir) ? models : [];
    const subBarrelDirs: string[] = [];

    if (isStrictDescendant(dir, modelDir)) {
      subBarrelDirs.push(modelDir);
    }

    if (isStrictDescendant(dir, enumDir)) {
      subBarrelDirs.push(enumDir);
    }

    fs.writeFileSync(
      path.join(dir, "index.ts"),
      renderBarrel(dir, directEnums, directModels, subBarrelDirs, enumDir, modelDir, config),
      "utf-8",
    );
  }
};
