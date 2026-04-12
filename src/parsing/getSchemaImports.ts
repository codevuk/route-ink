import type { SourceFile } from "ts-morph";
import type { Config } from "../schemas/config.schema.js";

export const getSchemaImports = (sourceFile: SourceFile, config: Config): string[] => {
  const schemaImportsSet = new Set<string>();

  // Collect imports from schemaPackage
  for (const importDecl of sourceFile.getImportDeclarations()) {
    if (importDecl.getModuleSpecifierValue() === config.schemaPackage) {
      for (const named of importDecl.getNamedImports()) {
        // Support `import { Foo as Bar }` — use the local alias
        const localName = named.getAliasNode()?.getText() ?? named.getName();
        schemaImportsSet.add(localName);
      }
    }
  }

  return [...schemaImportsSet]
}