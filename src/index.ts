import { program } from "commander";
import { generate } from "./actions/generate.js";

program
  .name("route-ink")
  .version("0.0.1")
  .description("A CLI tool to generate fully typed API clients from Fastify routes.")
  .showHelpAfterError()
  .showSuggestionAfterError();

program
  .command("generate")
  .description("Generate API client from Fastify routes.\n")
  .action(generate)

// Show help if no command provided
program.action(() => {
  program.help();
});

program.parse();