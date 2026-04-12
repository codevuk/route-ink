import type { SourceFile } from "ts-morph";

export type RouteFile = {
  fullPath: string;
  relativePath: string;
  route: string;
  sourceFile: SourceFile;
  schemaImports: string[];
}