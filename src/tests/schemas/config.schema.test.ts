import { describe, expect, it } from "vitest";
import { ConfigSchema, getOutputDirs, getOutputTargets } from "../../schemas/config.schema.js";

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

  it("rejects a string and an object entry that resolve to the same path", () => {
    const result = ConfigSchema.safeParse({ outputDir: ["./generated", { dir: "generated/", hooks: false }] });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.path).toEqual(["outputDir", 1]);
  });

  it("rejects unknown keys on object entries", () => {
    expect(ConfigSchema.safeParse({ outputDir: [{ dir: "./a", hook: false }] }).success).toBe(false);
  });
});

describe("getOutputTargets", () => {
  it("applies the top-level options to string entries", () => {
    const result = ConfigSchema.parse({ outputDir: "./a", exportQueryOptions: true });

    expect(getOutputTargets(result)).toEqual([{ dir: "./a", hooks: true, exportQueryOptions: true }]);
  });

  it("lets object entries override the top-level options", () => {
    const result = ConfigSchema.parse({
      outputDir: [
        "./feedback",
        { dir: "./portal", hooks: false },
        { dir: "./admin", exportQueryOptions: true },
      ],
    });

    expect(getOutputTargets(result)).toEqual([
      { dir: "./feedback", hooks: true, exportQueryOptions: false },
      { dir: "./portal", hooks: false, exportQueryOptions: false },
      { dir: "./admin", hooks: true, exportQueryOptions: true },
    ]);
    expect(getOutputDirs(result)).toEqual(["./feedback", "./portal", "./admin"]);
  });

  it("accepts a single object entry", () => {
    const result = ConfigSchema.parse({ outputDir: { dir: "./portal", hooks: false }, hooks: true });

    expect(getOutputTargets(result)).toEqual([{ dir: "./portal", hooks: false, exportQueryOptions: false }]);
  });
});
