import { describe, expect, it } from "vitest";
import { isComplexSchema } from "../../generation/util/isComplexSchema.js";

describe("isComplexSchema", () => {
  it("returns false for a simple identifier", () => {
    expect(isComplexSchema("UserSchema")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isComplexSchema(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isComplexSchema("")).toBe(false);
  });

  it("returns true for method call (dot + parens)", () => {
    expect(isComplexSchema("WeekRecordSchema.array()")).toBe(true);
  });

  it("returns true for generic function call with parens", () => {
    expect(isComplexSchema("PaginatedResponse(WeekRecordSchema)")).toBe(true);
  });

  it("returns true for chained zod expression", () => {
    expect(isComplexSchema("z.object({name: z.string()}).optional()")).toBe(true);
  });

  it("returns true for property access without call", () => {
    // A dot alone is enough — e.g. accessing a sub-schema via dot notation
    expect(isComplexSchema("Schemas.User")).toBe(true);
  });

  it("returns true for .array() suffix alone", () => {
    expect(isComplexSchema("TaskSchema.array()")).toBe(true);
  });

  it("returns true for .optional() suffix alone", () => {
    expect(isComplexSchema("TaskSchema.optional()")).toBe(true);
  });
});
