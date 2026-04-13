import { ANSI, color } from "./ansi.js";

export const formatBadge = (label: string, tone: "success" | "warning" | "error" | "info"): string => {
  if (tone === "success") {
    return color(` ✓ ${label} `, ANSI.green);
  }

  if (tone === "warning") {
    return color(` ! ${label} `, ANSI.yellow);
  }

  if (tone === "error") {
    return color(` x ${label} `, ANSI.red)
  }

  return color(` i ${label} `, ANSI.cyan);
};