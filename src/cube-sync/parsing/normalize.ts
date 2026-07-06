const IDENTIFIER_BOUNDARY = "[^A-Za-z0-9_]";

export const normalizeIdentifier = (value: string): string => {
  return value.trim().replace(/^[\["'`]+|[\]"'`]+$/g, "");
};

export const normalizeTableName = (value: string): string => {
  const withoutTemplate = value.trim().replace(/[{}]/g, "");
  const parts = withoutTemplate.split(".");
  const table = parts[parts.length - 1] ?? withoutTemplate;
  return normalizeIdentifier(table);
};

export const columnMatchesSql = (sql: string, column: string): boolean => {
  const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|${IDENTIFIER_BOUNDARY})["'\`]?${escapedColumn}["'\`]?($|${IDENTIFIER_BOUNDARY})`);
  return pattern.test(sql);
};

const SQL_FUNCTIONS_AND_KEYWORDS = new Set([
  "and",
  "as",
  "case",
  "cast",
  "coalesce",
  "concat",
  "cube",
  "date",
  "date_trunc",
  "day",
  "decimal",
  "double",
  "else",
  "end",
  "false",
  "float",
  "hour",
  "in",
  "int",
  "integer",
  "is",
  "lower",
  "month",
  "not",
  "null",
  "numeric",
  "or",
  "precision",
  "then",
  "true",
  "varchar",
  "text",
  "upper",
  "when",
  "year",
]);

export const extractOwnColumnReferences = (sql: string, knownColumns: Set<string>): string[] => {
  const references = new Set<string>();

  for (const match of sql.matchAll(/\{CUBE\}\.\s*["'`]?([A-Za-z_][A-Za-z0-9_]*)["'`]?/g)) {
    const column = match[1];
    if (column) {
      references.add(column);
    }
  }

  const trimmed = sql.trim();
  const bareIdentifier = trimmed.match(/^["'`]?([A-Za-z_][A-Za-z0-9_]*)["'`]?$/);

  if (bareIdentifier?.[1]) {
    references.add(bareIdentifier[1]);
  }

  if (references.size > 0) {
    return Array.from(references);
  }

  for (const column of knownColumns) {
    if (columnMatchesSql(sql, column)) {
      references.add(column);
    }
  }

  if (references.size > 0) {
    return Array.from(references);
  }

  const stripped = sql
    .replace(/\{[^}]+\}/g, " ")
    .replace(/'[^']*'/g, " ")
    .replace(/"[^"]*"/g, " ");

  for (const token of stripped.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)) {
    const value = token[0];
    if (!SQL_FUNCTIONS_AND_KEYWORDS.has(value.toLowerCase())) {
      references.add(value);
    }
  }

  return Array.from(references);
};
