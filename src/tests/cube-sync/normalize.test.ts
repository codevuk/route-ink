import { describe, expect, it } from "vitest";
import { extractOwnColumnReferences } from "../../cube-sync/parsing/normalize.js";

describe("extractOwnColumnReferences", () => {
  it("does not treat SQL cast types as orphaned column references", () => {
    expect(
      extractOwnColumnReferences("CASE WHEN {customer_count} > 0 THEN {count}::float / {customer_count} ELSE 0 END", new Set(["id"])),
    ).toEqual([]);
  });
});
