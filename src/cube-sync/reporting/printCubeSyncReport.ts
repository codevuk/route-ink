import { ANSI, color } from "../../actions/ui/ansi.js";
import { formatBadge } from "../../actions/ui/formatBadge.js";
import { printTable } from "../../actions/ui/printTable.js";
import type { Violation } from "../types.js";

const messagesForRule = (violations: Violation[], rule: Violation["rule"]): string[] => {
  return violations.filter((violation) => violation.rule === rule).map((violation) => violation.message);
};

export const printCubeSyncReport = (
  violations: Violation[],
  changedFileCount: number,
  generatedBaseFileCount = 0,
): void => {
  const enumViolations = messagesForRule(violations, "enum");
  const relationshipViolations = messagesForRule(violations, "relationships");
  const coverageViolations = messagesForRule(violations, "coverage");
  const actionableCount = enumViolations.length + relationshipViolations.length;

  console.log(`\n${formatBadge("cube-sync", "success")}`);
  console.log(` generated base files: ${color(String(generatedBaseFileCount), generatedBaseFileCount > 0 ? ANSI.yellow : ANSI.green)}`);
  console.log(` files patched: ${color(String(changedFileCount), changedFileCount > 0 ? ANSI.yellow : ANSI.green)}`);
  console.log(` enum/relationship updates: ${color(String(actionableCount), actionableCount > 0 ? ANSI.yellow : ANSI.green)}`);
  console.log(` coverage findings: ${color(String(coverageViolations.length), coverageViolations.length > 0 ? ANSI.yellow : ANSI.green)}`);

  printTable("Enum metadata", enumViolations, ANSI.yellow);
  printTable("Relationship metadata", relationshipViolations, ANSI.yellow);
  printTable("Coverage report", coverageViolations, ANSI.yellow);
};
