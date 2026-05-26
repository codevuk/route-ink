import z from "zod/v4";

export const PrismaConfigSchema = z.object({
  modelFileNamingStyle: z.string().default("[model].model.ts"),
  enumFileNamingStyle: z.string().default("[enum].enum.ts"),
  modelSchemaNaming: z.string().default("[Model]Schema"),
  enumSchemaNaming: z.string().default("[Enum]Schema"),
  nullStrategy: z.enum(["null", "nullish"]).default("null"),
  bigIntStrategy: z.enum(["string", "bigint"]).default("string"),
  bytesStrategy: z.enum(["string", "uint8array"]).default("string"),
});

export type PrismaConfig = z.infer<typeof PrismaConfigSchema>;
