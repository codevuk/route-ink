import type { Prisma8Config } from "../prisma8-config.schema.js";

export type Prisma8CodecMapping = {
  expression: string;
  /** Validator that must be imported from the configured temporal module. */
  temporalImport?: string;
};

type TemporalKind = "Instant" | "PlainDate" | "PlainDateTime" | "PlainTime";

const CODEC_ID = /^(?<provider>[^/]+)\/(?<name>[^@]+)@(?<version>.+)$/;

/**
 * Prisma 8 codec ids look like `pg/timestamptz-temporal@1`. Splitting once and
 * switching on the codec name keeps the mapping order-independent, unlike a
 * chain of unanchored regex tests.
 */
export const parseCodecId = (
  codecId: string,
): { provider: string; name: string; version: string } => {
  const groups = CODEC_ID.exec(codecId)?.groups;

  if (!groups) {
    throw new Error(`Malformed Prisma 8 codec id: ${codecId}`);
  }

  return { provider: groups.provider!, name: groups.name!, version: groups.version! };
};

const temporalToZod = (kind: TemporalKind, config: Prisma8Config): Prisma8CodecMapping => {
  switch (config.temporalStrategy) {
    case "string":
      return { expression: "z.string()" };
    case "date":
      return { expression: "z.coerce.date()" };
    case "temporal-zod": {
      // The coercing validator, not `z${kind}Instance`: generated model schemas
      // double as HTTP wire contracts, and a Temporal instance arrives on the
      // other side of JSON as an ISO string. `coerce` is a superset of
      // `instance` (it is a union containing it), so nothing is lost.
      const validator = `z${kind}`;
      return { expression: validator, temporalImport: validator };
    }
  }
};

export const mapPrisma8CodecToZod = (
  codecId: string,
  config: Prisma8Config,
): Prisma8CodecMapping => {
  const { name } = parseCodecId(codecId);

  switch (name) {
    case "text":
    case "varchar":
    case "char":
    case "uuid":
    case "inet":
      return { expression: "z.string()" };
    case "int":
    case "int2":
    case "int4":
    // Prisma emits a distinct codec for 64-bit integers narrowed to a JS
    // number. Both spellings are accepted so a rename does not hard-fail.
    case "int8-number":
    case "int8number":
      return { expression: "z.number().int()" };
    case "float":
    case "float4":
    case "float8":
      return { expression: "z.number()" };
    case "bool":
      return { expression: "z.boolean()" };
    case "json":
    case "jsonb":
      return { expression: "z.any()" };
    case "numeric":
      return { expression: "z.string()" };
    case "int8":
    case "unboundedint":
      return {
        expression: config.bigIntStrategy === "bigint" ? "z.bigint()" : "z.string()",
      };
    case "bytea":
      return {
        expression: config.bytesStrategy === "uint8array"
          ? "z.instanceof(Uint8Array)"
          : "z.string()",
      };
    case "date-string":
    case "time-string":
    case "timestamp-string":
    case "timestamptz-string":
      return { expression: "z.string()" };
    case "timestamptz-date":
      return { expression: "z.coerce.date()" };
    case "date-temporal":
      return temporalToZod("PlainDate", config);
    case "time-temporal":
      return temporalToZod("PlainTime", config);
    case "timestamp-temporal":
      return temporalToZod("PlainDateTime", config);
    case "timestamptz-temporal":
      return temporalToZod("Instant", config);
    case "enum":
      throw new Error(
        `Could not resolve the enum type for Prisma 8 codec '${codecId}'; `
        + "the contract has neither a `valueSet` reference nor `typeParams.typeName`",
      );
    default:
      throw new Error(`Unsupported Prisma 8 codec: ${codecId}`);
  }
};
