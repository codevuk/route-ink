import { describe, expect, it } from "vitest";
import { cleanupImports } from "../../generation/util/cleanupImports.js";

describe("cleanupImports", () => {
  it("removes the zod import when z is never referenced", () => {
    const input = [
      'import z from "zod/v4";',
      'import { useMutation } from "@tanstack/react-query";',
      "",
      "const url = \"/ping\";",
    ].join("\n");

    const result = cleanupImports(input);

    expect(result).not.toContain('import z from "zod/v4";');
    expect(result).toContain('import { useMutation } from "@tanstack/react-query";');
  });

  it("keeps the zod import when z is referenced", () => {
    const input = [
      'import z from "zod/v4";',
      "",
      "type Input = z.output<typeof UserSchema>;",
    ].join("\n");

    const result = cleanupImports(input);

    expect(result).toContain('import z from "zod/v4";');
  });

  it("removes an empty schema-package import", () => {
    const input = [
      'import z from "zod/v4";',
      'import {  } from "@workspace/schemas";',
      "",
      "type Input = z.output<typeof UserSchema>;",
    ].join("\n");

    const result = cleanupImports(input);

    expect(result).not.toContain("@workspace/schemas");
  });

  it("keeps a non-empty schema-package import", () => {
    const input = [
      'import { UserSchema } from "@workspace/schemas";',
      "",
      "const x = UserSchema;",
    ].join("\n");

    const result = cleanupImports(input);

    expect(result).toContain('import { UserSchema } from "@workspace/schemas";');
  });
});
