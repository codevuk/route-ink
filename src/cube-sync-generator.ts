import generatorHelper from "@prisma/generator-helper";
import { generateCubeSync } from "./cube-sync/actions/generate-cube-sync.js";

const { generatorHandler } = generatorHelper;

generatorHandler({
  onManifest: () => ({
    defaultOutput: "./generated/cube-sync",
    prettyName: "Route Ink Cube.js Base Schema Generator",
  }),
  onGenerate: async (options) => {
    await generateCubeSync(options);
  },
});
