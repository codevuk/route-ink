import { existsSync, readFileSync } from "fs";
import { parse } from "yaml";
import z from "zod/v4";
import { normalizeTableName } from "../parsing/normalize.js";
import type { CubeSyncExceptions } from "../types.js";

const ReasonedTableExceptionSchema = z.object({
  table: z.string(),
  reason: z.string().min(1),
});

const ReasonedColumnExceptionSchema = z.object({
  table: z.string(),
  column: z.string(),
  reason: z.string().min(1),
});

const ReasonedJoinExceptionSchema = z.object({
  from: z.string(),
  to: z.string(),
  reason: z.string().min(1),
});

const ExceptionsFileSchema = z.object({
  tables: z.array(ReasonedTableExceptionSchema).default([]),
  columns: z.array(ReasonedColumnExceptionSchema).default([]),
  joins: z.array(ReasonedJoinExceptionSchema).default([]),
});

export const EMPTY_EXCEPTIONS: CubeSyncExceptions = {
  tables: [],
  columns: [],
  joins: [],
};

export const readExceptionsFile = (exceptionsFile?: string): CubeSyncExceptions => {
  if (!exceptionsFile || !existsSync(exceptionsFile)) {
    return EMPTY_EXCEPTIONS;
  }

  const parsed = ExceptionsFileSchema.safeParse(parse(readFileSync(exceptionsFile, "utf8")) ?? {});

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid cube sync exceptions file: ${issues}`);
  }

  return parsed.data;
};

export const isTableExcepted = (exceptions: CubeSyncExceptions, table: string): boolean => {
  const normalizedTable = normalizeTableName(table);
  return exceptions.tables.some((entry) => normalizeTableName(entry.table) === normalizedTable);
};

export const isColumnExcepted = (
  exceptions: CubeSyncExceptions,
  table: string,
  column: string,
): boolean => {
  const normalizedTable = normalizeTableName(table);
  return exceptions.columns.some((entry) => (
    normalizeTableName(entry.table) === normalizedTable && entry.column === column
  ));
};

export const isJoinExcepted = (
  exceptions: CubeSyncExceptions,
  from: string,
  to: string,
): boolean => {
  const normalizedFrom = normalizeTableName(from);
  const normalizedTo = normalizeTableName(to);

  return exceptions.joins.some((entry) => {
    const entryFrom = normalizeTableName(entry.from);
    const entryTo = normalizeTableName(entry.to);

    return (
      (entryFrom === normalizedFrom && entryTo === normalizedTo)
      || (entryFrom === normalizedTo && entryTo === normalizedFrom)
    );
  });
};
