import { generatorHandler } from "@prisma/generator-helper";
import { generateZod } from "./prisma-to-zod/actions/generate-zod.js";

generatorHandler({
  onManifest: () => ({
    defaultOutput: "./generated/schemas",
    prettyName: "Route Ink Zod Generator",
  }),
  onGenerate: async (options) => {
    await generateZod(options);
  },
});
