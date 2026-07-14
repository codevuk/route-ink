import { describe, expect, it } from "vitest";
import { loadTemplateFile } from "../../generation/loadTemplateFile.js";

describe("util templates", () => {
  // Regression: buildQueryKey used to return string[], which pinned the
  // TQueryKey generic of the queryOptions factories to a mutable array and
  // made the suspense hooks reject any user-supplied options (TS2345:
  // "'readonly unknown[]' is 'readonly' and cannot be assigned to the mutable
  // type 'string[]'").
  it("buildQueryKey returns QueryKey, not a mutable array", () => {
    const template = loadTemplateFile("util/buildQueryKey.ts.template");
    expect(template).toContain('import type { QueryKey } from "@tanstack/react-query";');
    expect(template).toContain("): QueryKey =>");
    expect(template).not.toContain("): string[]");
  });
});
