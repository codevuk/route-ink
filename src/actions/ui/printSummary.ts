import { ANSI, color } from "./ansi.js";

export const printSummary = (routesCount: number, warningsCount: number, errorsCount: number) => {
  const routes = color(String(routesCount), ANSI.cyan);

  const warningsTone = warningsCount > 0
    ? ANSI.yellow
    : ANSI.green;

  const errorsTone = errorsCount > 0
    ? ANSI.red
    : ANSI.green;

  const warnings = color(String(warningsCount), warningsTone);
  const errors = color(String(errorsCount), errorsTone);

  console.log(`\n${color("Summary", ANSI.bold)} ${color("(route-ink)", ANSI.gray)}`);
  console.log(` routes: ${routes} | warnings: ${warnings} | errors: ${errors}`);
};