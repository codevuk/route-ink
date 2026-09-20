export type PrismaModelField = {
  name: string;
  zodExpression: string;
};

/**
 * A resolved Temporal import: the module is carried here rather than re-read
 * from config at render time, so the shared generation layer needs no
 * Prisma 8-only config to emit it.
 */
export type TemporalImport = {
  module: string;
  symbols: string[];
};

export type PrismaModel = {
  name: string;
  fields: PrismaModelField[];
  enumImports: string[];
  /** Omitted by Prisma 7. */
  temporalImport?: TemporalImport | null;
};

export type PrismaEnum = {
  name: string;
  values: string[];
};
