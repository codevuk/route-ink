import fs from "fs";
import path from "path";
import type { RouteFile } from "../types/RouteFile.js";
import { getRouteOutputDirectory } from "./util/getRouteOutputDirectory.js";

type GeneratedHookKind = "query" | "mutation";

type GeneratedHookExport = {
  exportName: string;
  importPath: string;
  directoryPath: string;
  kind: GeneratedHookKind;
};

const toImportPath = (fromDirectory: string, targetPath: string) => {
  const relativePath = path.posix.relative(fromDirectory, targetPath);

  return relativePath.startsWith(".")
    ? relativePath
    : `./${relativePath}`;
};

const createExportStatement = (exportName: string, importPath: string) => `export { ${exportName} } from "${importPath}";`;

export const getGeneratedHookExports = (routes: Pick<RouteFile, "relativePath" | "endpoints">[]): GeneratedHookExport[] => {
  const generatedExports: GeneratedHookExport[] = [];

  for (const routeFile of routes) {
    const routeOutputDirectory = getRouteOutputDirectory(routeFile.relativePath);
    const directoryPath = routeOutputDirectory === ""
      ? "endpoints"
      : path.posix.join("endpoints", routeOutputDirectory);

    for (const endpoint of routeFile.endpoints) {
      if (endpoint.method !== "GET" && endpoint.method !== "POST" && endpoint.method !== "PUT" && endpoint.method !== "PATCH" && endpoint.method !== "DELETE") {
        continue;
      }

      const kind: GeneratedHookKind = endpoint.method === "GET" ? "query" : "mutation";
      const exportName = endpoint.method === "GET"
        ? `use${endpoint.operationId}SuspenseQuery`
        : `use${endpoint.operationId}Mutation`;

      generatedExports.push({
        exportName,
        importPath: path.posix.join(directoryPath, endpoint.operationId),
        directoryPath,
        kind,
      });
    }
  }

  return generatedExports.sort((left, right) => left.exportName.localeCompare(right.exportName));
};

export const buildBarrelFileContents = (routes: Pick<RouteFile, "relativePath" | "endpoints">[]): Record<string, string> => {
  const generatedHookExports = getGeneratedHookExports(routes);
  const barrelFiles: Record<string, string> = {};
  const directoryPaths = new Set<string>(["endpoints"]);

  for (const generatedHookExport of generatedHookExports) {
    const directorySegments = generatedHookExport.directoryPath.split("/");

    for (let index = 1; index <= directorySegments.length; index += 1) {
      directoryPaths.add(directorySegments.slice(0, index).join("/"));
    }
  }

  for (const directoryPath of Array.from(directoryPaths).sort()) {
    const exportStatements = generatedHookExports
      .filter((generatedHookExport) => generatedHookExport.directoryPath === directoryPath || generatedHookExport.directoryPath.startsWith(`${directoryPath}/`))
      .map((generatedHookExport) => createExportStatement(
        generatedHookExport.exportName,
        toImportPath(directoryPath, generatedHookExport.importPath),
      ));

    barrelFiles[path.posix.join(directoryPath, "index.ts")] = `${exportStatements.join("\n")}\n`;
  }

  const queryExports = generatedHookExports
    .filter((generatedHookExport) => generatedHookExport.kind === "query")
    .map((generatedHookExport) => createExportStatement(
      generatedHookExport.exportName,
      toImportPath("", generatedHookExport.importPath),
    ));

  const mutationExports = generatedHookExports
    .filter((generatedHookExport) => generatedHookExport.kind === "mutation")
    .map((generatedHookExport) => createExportStatement(
      generatedHookExport.exportName,
      toImportPath("", generatedHookExport.importPath),
    ));

  const rootExports = [
    ...generatedHookExports.map((generatedHookExport) => createExportStatement(
      generatedHookExport.exportName,
      toImportPath("", generatedHookExport.importPath),
    )),
    'export * from "./util";',
  ];

  barrelFiles["queries.ts"] = `${queryExports.join("\n")}\n`;
  barrelFiles["mutations.ts"] = `${mutationExports.join("\n")}\n`;
  barrelFiles["index.ts"] = `${rootExports.join("\n")}\n`;

  return barrelFiles;
};

export const createBarrelFiles = (routes: Pick<RouteFile, "relativePath" | "endpoints">[], outputRoot: string) => {
  const barrelFiles = buildBarrelFileContents(routes);

  for (const [relativeFilePath, content] of Object.entries(barrelFiles)) {
    const outputFilePath = path.join(outputRoot, relativeFilePath);
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
    fs.writeFileSync(outputFilePath, content, "utf-8");
  }
};