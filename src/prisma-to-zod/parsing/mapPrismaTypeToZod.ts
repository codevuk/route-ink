import type { DMMF } from "@prisma/generator-helper";
import type { PrismaConfig } from "../prisma-config.schema.js";
import { expandNamingPattern } from "../util/expandNamingPattern.js";

const scalarToZod = (type: string, config: PrismaConfig): string => {
  switch (type) {
    case "String":
      return "z.string()";
    case "Int":
      return "z.number().int()";
    case "Float":
      return "z.number()";
    case "Boolean":
      return "z.boolean()";
    case "DateTime":
      return "z.coerce.date()";
    case "Json":
      return "z.any()";
    case "Decimal":
      return "z.string()";
    case "BigInt":
      return config.bigIntStrategy === "bigint" ? "z.bigint()" : "z.string()";
    case "Bytes":
      return config.bytesStrategy === "uint8array" ? "z.instanceof(Uint8Array)" : "z.string()";
    default:
      throw new Error(`Unsupported Prisma scalar type: ${type}`);
  }
};

export const mapPrismaTypeToZod = (field: DMMF.Field, config: PrismaConfig): string => {
  let expression: string;

  if (field.kind === "enum") {
    expression = expandNamingPattern(config.enumSchemaNaming, field.type, "enum");
  }
  else if (field.kind === "scalar") {
    expression = scalarToZod(field.type, config);
  }
  else {
    throw new Error(`Unexpected field kind '${field.kind}' for field '${field.name}'`);
  }

  if (field.isList) {
    expression = `z.array(${expression})`;
  }

  if (!field.isRequired) {
    expression += config.nullStrategy === "nullish" ? ".nullish()" : ".nullable()";
  }

  return expression;
};
