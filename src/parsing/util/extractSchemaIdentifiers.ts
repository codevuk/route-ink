import { Node, SyntaxKind } from "ts-morph";

/**
 * Extracts schema identifier names from an AST node.
 * Handles:
 * - Direct identifiers: GetWeeksQuerySchema
 * - Function calls: PaginatedResponse(WeekDetailsSchema)
 * - Ignores raw zod objects: z.object({...})
 * 
 * @param node The AST node to extract identifiers from
 * @param availableImports Set of imported schema names from the schema package
 * @returns Array of unique schema identifiers used in this node
 */
export function extractSchemaIdentifiers(node: Node | undefined, availableImports: Set<string>): string[] {
  if (!node) {
    return [];
  }

  const identifiers = new Set<string>();

  // Recursively find all identifiers in the node
  const findIdentifiers = (node: Node) => {
    // If it's an identifier, check if it's in our available imports
    if (node.isKind(SyntaxKind.Identifier)) {

      const name = node.getText();

      if (availableImports.has(name)) {
        identifiers.add(name);
      }
    }

    // Recursively process children
    node.forEachChild(findIdentifiers);
  };

  findIdentifiers(node);

  return Array.from(identifiers);
}
