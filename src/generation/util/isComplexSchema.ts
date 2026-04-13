/**
 * Determines if a schema expression is "complex" and needs to be stored in a const
 * before being used in typeof expressions.
 * 
 * Complex schemas include:
 * - Method calls: WeekRecordSchema.array()
 * - Function calls: PaginatedResponse(WeekRecordSchema)
 * - Chained calls: z.object({...}).optional()
 * 
 * Simple schemas are just identifiers: WeekRecordSchema
 */
export const isComplexSchema = (schema: string | undefined): boolean => {
  if (!schema) return false;

  // Check for parentheses (function/method calls) or dots (property access/chaining)
  return schema.includes('(') || schema.includes('.');
};
