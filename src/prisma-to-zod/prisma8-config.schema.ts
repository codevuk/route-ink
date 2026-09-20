import z from "zod/v4";
import { PrismaConfigSchema } from "./prisma-config.schema.js";

export const Prisma8ConfigSchema = PrismaConfigSchema.extend({
  temporalStrategy: z.enum(["temporal-zod", "string", "date"]).default("temporal-zod"),
  temporalImportModule: z.string().min(1).default("temporal-zod/base"),
});

export type Prisma8Config = z.infer<typeof Prisma8ConfigSchema>;

export type Prisma8ConfigInput = z.input<typeof Prisma8ConfigSchema>;

export const Prisma8FileConfigSchema = Prisma8ConfigSchema.extend({
  contract: z.string().min(1),
  output: z.string().min(1),
});

export type Prisma8FileConfig = z.infer<typeof Prisma8FileConfigSchema>;
