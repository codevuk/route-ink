import type { ObjectLiteralExpression } from "ts-morph";
import { getPropertyAssignment } from "./getPropertyAssignment.js";

export function getPropertyValue(obj: ObjectLiteralExpression, name: string): string | undefined {
  const property = getPropertyAssignment(obj, name);

  if (!property) {
    return undefined;
  }

  const initializer = property.getInitializer();

  if (!initializer) {
    return undefined;
  }

  return initializer.getText();
}