import fs from "fs";
import path from "path";
import type { GenerationOptions } from "../schemas/config.schema.js";
import type { RouteFile } from "../types/RouteFile.js";
import { type EndpointKind, getEndpointExports, getEndpointKind } from "./util/getEndpointShape.js";
import { getRouteOutputDirectory } from "./util/getRouteOutputDirectory.js";

type BarrelOptions = Pick<GenerationOptions, "hooks" | "exportQueryOptions">;

type GeneratedExport = {
  exportName: string;
  importPath: string;
  directoryPath: string;
  kind: EndpointKind;
  isType: boolean;
};

const toImportPath = (fromDirectory: string, targetPath: string) => {
  const relativePath = path.posix.relative(fromDirectory, targetPath);

  return relativePath.startsWith(".")
    ? relativePath
    : `./${relativePath}`;
};

// Types are re-exported with `export type` so consumers using isolatedModules
// can re-export them.
const createExportStatement = (generatedExport: GeneratedExport, fromDirectory: string) => `export ${generatedExport.isType ? "type " : ""}{ ${generatedExport.exportName} } from "${toImportPath(fromDirectory, generatedExport.importPath)}";`;

export const getGeneratedExports = (routes: Pick<RouteFile, "relativePath" | "endpoints">[], options: BarrelOptions): GeneratedExport[] => {
  const generatedExports: GeneratedExport[] = [];

  for (const routeFile of routes) {
    const routeOutputDirectory = getRouteOutputDirectory(routeFile.relativePath);
    const directoryPath = routeOutputDirectory === ""
      ? "endpoints"
      : path.posix.join("endpoints", routeOutputDirectory);

    for (const endpoint of routeFile.endpoints) {
      const kind = getEndpointKind(endpoint);

      if (!kind) {
        continue;
      }

      for (const endpointExport of getEndpointExports(endpoint, options)) {
        generatedExports.push({
          exportName: endpointExport.name,
          importPath: path.posix.join(directoryPath, endpoint.operationId),
          directoryPath,
          kind,
          isType: endpointExport.isType,
        });
      }
    }
  }

  return generatedExports.sort((left, right) => left.exportName.localeCompare(right.exportName));
};

export const buildBarrelFileContents = (routes: Pick<RouteFile, "relativePath" | "endpoints">[], options: BarrelOptions): Record<string, string> => {
  const generatedExports = getGeneratedExports(routes, options);
  const barrelFiles: Record<string, string> = {};
  const directoryPaths = new Set<string>(["endpoints"]);

  for (const generatedExport of generatedExports) {
    const directorySegments = generatedExport.directoryPath.split("/");

    for (let index = 1; index <= directorySegments.length; index += 1) {
      directoryPaths.add(directorySegments.slice(0, index).join("/"));
    }
  }

  for (const directoryPath of Array.from(directoryPaths).sort()) {
    const exportStatements = generatedExports
      .filter((generatedExport) => generatedExport.directoryPath === directoryPath || generatedExport.directoryPath.startsWith(`${directoryPath}/`))
      .map((generatedExport) => createExportStatement(generatedExport, directoryPath));

    barrelFiles[path.posix.join(directoryPath, "index.ts")] = `${exportStatements.join("\n")}\n`;
  }

  const queryExports = generatedExports
    .filter((generatedExport) => generatedExport.kind === "query")
    .map((generatedExport) => createExportStatement(generatedExport, ""));

  const mutationExports = generatedExports
    .filter((generatedExport) => generatedExport.kind === "mutation")
    .map((generatedExport) => createExportStatement(generatedExport, ""));

  const rootExports = [
    ...generatedExports.map((generatedExport) => createExportStatement(generatedExport, "")),
    'export * from "./util";',
  ];

  barrelFiles["queries.ts"] = `${queryExports.join("\n")}\n`;
  barrelFiles["mutations.ts"] = `${mutationExports.join("\n")}\n`;
  barrelFiles["index.ts"] = `${rootExports.join("\n")}\n`;

  return barrelFiles;
};

export const createBarrelFiles = (routes: Pick<RouteFile, "relativePath" | "endpoints">[], outputRoot: string, options: BarrelOptions) => {
  const barrelFiles = buildBarrelFileContents(routes, options);

  for (const [relativeFilePath, content] of Object.entries(barrelFiles)) {
    const outputFilePath = path.join(outputRoot, relativeFilePath);
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
    fs.writeFileSync(outputFilePath, content, "utf-8");
  }
};