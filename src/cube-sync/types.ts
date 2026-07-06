import type { Document } from "yaml";

export type PrismaColumn = {
  modelName: string;
  table: string;
  fieldName: string;
  column: string;
  kind: "scalar" | "enum";
  enumName: string | undefined;
  enumValues: string[] | undefined;
};

export type PrismaRelation = {
  fromModel: string;
  fromTable: string;
  toModel: string;
  toTable: string;
  relationName: string;
};

export type PrismaModelTable = {
  modelName: string;
  table: string;
};

export type CubeDimension = {
  name: string;
  sql: string | undefined;
  metaEnum: string[] | undefined;
  path: Array<string | number>;
};

export type CubeMeasure = {
  name: string;
  sql: string | undefined;
  path: Array<string | number>;
};

export type CubeJoin = {
  name: string;
  relationship: string | undefined;
  path: Array<string | number>;
};

export type CubeRelationshipMeta = {
  cube: string | undefined;
  type: string | undefined;
  note?: unknown;
  path: Array<string | number>;
};

export type CubeDefinition = {
  name: string;
  sqlTable: string | undefined;
  extendsCube: string | undefined;
  normalizedTable: string;
  filePath: string;
  cubeIndex: number;
  path: Array<string | number>;
  dimensions: CubeDimension[];
  measures: CubeMeasure[];
  joins: CubeJoin[];
  relationships: CubeRelationshipMeta[];
};

export type CubeFile = {
  filePath: string;
  source: string;
  doc: Document.Parsed;
  cubes: CubeDefinition[];
  changed: boolean;
};

export type Violation = {
  rule: "enum" | "relationships" | "coverage" | "generated-base";
  message: string;
};

export type CubeSyncExceptions = {
  tables: Array<{ table: string; reason: string }>;
  columns: Array<{ table: string; column: string; reason: string }>;
  joins: Array<{ from: string; to: string; reason: string }>;
};
