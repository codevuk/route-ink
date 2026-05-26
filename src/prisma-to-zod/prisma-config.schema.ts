import z from "zod/v4";

export const PrismaConfigSchema = z.object({
  modelOutputDir: z.string().default("."),
  enumOutputDir: z.string().default("."),
  modelFileNamingStyle: z.string().default("[model].model.ts"),
  enumFileNamingStyle: z.string().default("[enum].enum.ts"),
  modelSchemaNaming: z.string().default("[Model]Schema"),
  enumSchemaNaming: z.string().default("[Enum]Schema"),
  nullStrategy: z.enum(["null", "nullish"]).default("null"),
  bigIntStrategy: z.enum(["string", "bigint"]).default("string"),
  bytesStrategy: z.enum(["string", "uint8array"]).default("string"),
  importStyle: z.enum(["esm", "cjs"]).default("esm"),
  topLevelBarrel: z.boolean().default(true),
});

export type PrismaConfig = z.infer<typeof PrismaConfigSchema>;
