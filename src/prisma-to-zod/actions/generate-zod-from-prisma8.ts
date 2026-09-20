import { parsePrisma8Contract } from "../parsing/parsePrisma8Contract.js";
import { Prisma8ConfigSchema, type Prisma8ConfigInput } from "../prisma8-config.schema.js";
import { Prisma8ContractSchema } from "../prisma8-contract.schema.js";
import { formatZodIssues } from "../util/formatZodIssues.js";
import { emitZod } from "./emitZod.js";

export type GenerateZodFromPrisma8Options = {
  contract: unknown;
  outputDir: string;
  config?: Prisma8ConfigInput;
};

export const generateZodFromPrisma8 = ({
  contract,
  outputDir,
  config: rawConfig = {},
}: GenerateZodFromPrisma8Options): void => {
  const contractResult = Prisma8ContractSchema.safeParse(contract);

  if (!contractResult.success) {
    throw new Error(`Invalid Prisma 8 contract: ${formatZodIssues(contractResult.error.issues)}`);
  }

  const configResult = Prisma8ConfigSchema.safeParse(rawConfig);

  if (!configResult.success) {
    throw new Error(`Invalid prisma-to-zod config: ${formatZodIssues(configResult.error.issues)}`);
  }

  const config = configResult.data;
  const { models, enums } = parsePrisma8Contract(contractResult.data, config);

  emitZod(models, enums, outputDir, config, "contract");
};
