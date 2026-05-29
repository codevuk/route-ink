/**
 * Strips import statements that the compiled file does not actually use.
 *
 * The templates unconditionally import `z` from "zod/v4" and the named schemas
 * from the schema package, but depending on the endpoint shape those imports
 * may end up unused:
 *
 * - `z` is only referenced through the schema placeholders (`z.output`,
 *   `z.input`, `z.infer`, `z.any()`). A mutation with no response/body/params
 *   schema never references `z`, so the leftover import triggers a TypeScript
 *   "unused import" error in consumer projects.
 * - The schema-package import becomes `import {  } from "..."` when an endpoint
 *   has no schema imports. That empty-object import is valid TypeScript (no
 *   error), but it is dead code worth removing.
 */
export const cleanupImports = (content: string): string => {
  let result = content;

  // Drop the schema-package import when there are no named imports left, e.g.
  // `import {  } from "@workspace/schemas";`
  result = result.replace(/^import \{\s*\} from "[^"]*";\n/m, "");

  // Drop the zod import when `z` is never referenced in the rest of the file.
  const zodImport = 'import z from "zod/v4";\n';
  const withoutZodImport = result.replace(zodImport, "");
  if (!/\bz\./.test(withoutZodImport)) {
    result = withoutZodImport;
  }

  return result;
};
