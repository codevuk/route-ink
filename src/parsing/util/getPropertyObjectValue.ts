import { PropertyAssignment, SyntaxKind, type ObjectLiteralExpression } from "ts-morph";
import { getPropertyAssignment } from "./getPropertyAssignment.js";

export const getPropertyObjectValue = (obj: ObjectLiteralExpression, name: string): Record<string | number, string> | undefined => {
  const property = getPropertyAssignment(obj, name);

  if (!property) {
    return undefined;
  }

  const initializer = property.getInitializer();

  if (!initializer || !initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
    console.warn(`Expected property '${name}' to be an object literal.`);
    return undefined;
  }

  const responseObject = initializer as ObjectLiteralExpression;

  const result: Record<string | number, string> = {};

  for (const prop of responseObject.getProperties()) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) {
      console.warn(`Expected property in '${name}' object to be a simple assignment.`);
      continue;
    }

    const property = prop as PropertyAssignment;

    const key = property.getName();
    const valueInitializer = property.getInitializer();

    if (!valueInitializer) {
      console.warn(`Property '${key}' in '${name}' object has no initializer.`);
      continue;
    }

    const value = valueInitializer.getText();

    result[key] = value;
  }

  return result;
}