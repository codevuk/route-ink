import { describe, expect, it } from "vitest";
import { ConfigSchema, getOutputDirs } from "../../schemas/config.schema.js";

describe("ConfigSchema outputDir", () => {
  it("accepts a single output directory", () => {
    const result = ConfigSchema.safeParse({ outputDir: "./src/generated" });

    expect(result.success).toBe(true);
    expect(getOutputDirs(result.data!)).toEqual(["./src/generated"]);
  });

  it("accepts multiple output directories", () => {
    const result = ConfigSchema.safeParse({ outputDir: ["../apps/web/src/generated", "../apps/admin/src/generated"] });

    expect(result.success).toBe(true);
    expect(getOutputDirs(result.data!)).toEqual(["../apps/web/src/generated", "../apps/admin/src/generated"]);
  });

  it("rejects an empty output directory list", () => {
    expect(ConfigSchema.safeParse({ outputDir: [] }).success).toBe(false);
  });

  it("rejects empty output directory strings", () => {
    expect(ConfigSchema.safeParse({ outputDir: "" }).success).toBe(false);
    expect(ConfigSchema.safeParse({ outputDir: ["./a", ""] }).success).toBe(false);
  });

  it("rejects output directories that resolve to the same path", () => {
    const result = ConfigSchema.safeParse({ outputDir: ["./generated", "generated/"] });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.path).toEqual(["outputDir", 1]);
  });
});
