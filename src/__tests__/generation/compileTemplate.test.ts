import { describe, expect, it } from "vitest";
import { compileTemplate } from "../../generation/compileTemplate.js";

describe("compileTemplate", () => {
  it("replaces a single placeholder with its value", () => {
    expect(compileTemplate("Hello @name@!", { name: "World" })).toBe("Hello World!");
  });

  it("replaces multiple different placeholders", () => {
    expect(
      compileTemplate("@greeting@ @name@, you have @count@ messages.", {
        greeting: "Hello",
        name: "Alice",
        count: "5",
      }),
    ).toBe("Hello Alice, you have 5 messages.");
  });

  it("replaces all occurrences of the same placeholder", () => {
    expect(compileTemplate("@x@ + @x@ = @result@", { x: "1", result: "2" })).toBe("1 + 1 = 2");
  });

  it("replaces undefined value with empty string", () => {
    expect(compileTemplate("Hello @prefix@@name@!", { prefix: undefined, name: "Bob" })).toBe("Hello Bob!");
  });

  it("leaves template unchanged when no data keys match", () => {
    expect(compileTemplate("No placeholders here.", { foo: "bar" })).toBe("No placeholders here.");
  });

  it("handles empty template", () => {
    expect(compileTemplate("", { foo: "bar" })).toBe("");
  });

  it("handles empty data object", () => {
    expect(compileTemplate("Hello @name@!", {})).toBe("Hello @name@!");
  });

  it("does not replace partial placeholder patterns", () => {
    expect(compileTemplate("@open but no close", { open: "value" })).toBe("@open but no close");
  });

  it("handles multiline templates with multiple placeholders", () => {
    const template = `import { @imports@ } from "@package@";\n\nexport const use@identifier@Hook = () => {};`;
    expect(
      compileTemplate(template, {
        imports: "useQuery",
        package: "@tanstack/react-query",
        identifier: "GetUsers",
      }),
    ).toBe(`import { useQuery } from "@tanstack/react-query";\n\nexport const useGetUsersHook = () => {};`);
  });
});
