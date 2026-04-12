import { SyntaxKind, type ObjectLiteralExpression, type PropertyAssignment } from "ts-morph";

/**
 * Gets a PropertyAssignment by name from an ObjectLiteralExpression.
 */
export function getPropertyAssignment(obj: ObjectLiteralExpression, name: string): PropertyAssignment | undefined {
  const prop = obj.getProperties().find((p) => {
    if (p.isKind(SyntaxKind.PropertyAssignment)) {
      return (p as PropertyAssignment).getName() === name;
    }
    return false;
  });

  return prop
    ? (prop as PropertyAssignment)
    : undefined;
}