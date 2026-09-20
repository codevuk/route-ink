import type z from "zod/v4";

export const formatZodIssues = (issues: readonly z.core.$ZodIssue[]): string =>
  issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
