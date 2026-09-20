import { readFile } from "node:fs/promises";
import path from "node:path";
import { program } from "commander";
import { generateZodFromPrisma8 } from "./prisma-to-zod/actions/generate-zod-from-prisma8.js";
import { Prisma8FileConfigSchema } from "./prisma-to-zod/prisma8-config.schema.js";
import { formatZodIssues } from "./prisma-to-zod/util/formatZodIssues.js";

const readJson = async (filePath: string): Promise<unknown> => {
  const contents = await readFile(filePath, "utf8");

  try {
    return JSON.parse(contents);
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(`Could not parse JSON at ${filePath}: ${reason}`);
  }
};

program
  .name("route-ink-prisma8")
  .description("Generate Zod schemas from emitted Prisma 8 contract.json artifacts.")
  .requiredOption("--config <path>", "Path to the Route Ink Prisma 8 JSON config")
  .action(async ({ config: configPath }: { config: string }) => {
    const absoluteConfigPath = path.resolve(configPath);
    const configResult = Prisma8FileConfigSchema.safeParse(await readJson(absoluteConfigPath));

    if (!configResult.success) {
      throw new Error(
        `Invalid Route Ink Prisma 8 config: ${formatZodIssues(configResult.error.issues)}`,
      );
    }

    const { contract, output, ...generatorConfig } = configResult.data;
    const baseDir = path.dirname(absoluteConfigPath);

    generateZodFromPrisma8({
      contract: await readJson(path.resolve(baseDir, contract)),
      outputDir: path.resolve(baseDir, output),
      config: generatorConfig,
    });
  });

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
