import { toCamelCase, toKebabCase, toPascalCase, toUpperSnakeCase } from "./casing.js";

type Kind = "model" | "enum";

export const expandNamingPattern = (pattern: string, name: string, kind: Kind): string => {
  const lower = kind;
  const pascal = kind === "model" ? "Model" : "Enum";
  const upper = kind.toUpperCase();
  const kebab = `${lower}-kebab`;

  return pattern
    .replaceAll(`[${pascal}]`, toPascalCase(name))
    .replaceAll(`[${upper}]`, toUpperSnakeCase(name))
    .replaceAll(`[${kebab}]`, toKebabCase(name))
    .replaceAll(`[${lower}]`, toCamelCase(name));
};
