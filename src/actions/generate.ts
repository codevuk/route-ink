import { generateOutput } from "../generation/generateOutput.js";
import { parseRouteFiles } from "../parsing/parseRouteFile.js";
import { validateRouteFiles } from "../validation/validateRouteFiles.js";
import { loadConfig } from "./load-config.js";
import { ANSI, color } from "./ui/ansi.js";
import { formatBadge } from "./ui/formatBadge.js";
import { printSummary } from "./ui/printSummary.js";
import { printTable } from "./ui/printTable.js";

export const generate = async () => {
  console.log(`\n${color("Route Ink", ANSI.bold)} ${color("generator", ANSI.dim)}`);
  console.log(`${formatBadge("START", "info")} Generating API client...`);

  // Lets first load the config
  try {
    const result = await loadConfig();

    if (!result.success) {
      console.error(`${formatBadge("FAILED", "error")} Could not load config`);
      console.error(` ${color(result.error, ANSI.red)}`);
      return process.exit(1);
    }

    console.log(`${formatBadge("OK", "success")} Loaded config`);

    const { config } = result;

    const warnings: string[] = [];

    const routes = parseRouteFiles(config, warnings);
    console.log(`${formatBadge("OK", "success")} Parsed route files`);

    const errors = validateRouteFiles(routes);

    if (warnings.length > 0) {
      printTable(color("Warnings", ANSI.yellow), warnings.map((warning) => color(warning, ANSI.yellow)));
    }

    if (errors.length > 0) {
      printTable(color("Validation Errors", ANSI.red), errors.map((error) => color(error, ANSI.red)));
    }

    if (errors.length > 0) {
      printSummary(routes.length, warnings.length, errors.length);
      console.error(`\n${formatBadge("FAILED", "error")} Aborting generation due to validation errors.`);
      return process.exit(1);
    }

    generateOutput(routes, config);
    printSummary(routes.length, warnings.length, errors.length);
    console.log(`\n${formatBadge("SUCCESS", "success")} API client generated.`);

    // logger(routes);

  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n${formatBadge("FAILED", "error")} Unexpected error while generating API client`);
    console.error(` ${color(message, ANSI.red)}`);
    process.exit(1);
  }
}