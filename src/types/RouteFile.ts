import type { SourceFile } from "ts-morph";
import type { Endpoint } from "./Endpoint.js";

export type RouteFile = {
  fullPath: string;
  relativePath: string;
  route: string;
  sourceFile: SourceFile;
  schemaImports: string[];
  endpoints: Endpoint[];
}