import z from "zod/v4";

export const EntityReferenceSchema = z.object({
  namespaceId: z.string(),
  entityName: z.string(),
});

export type Prisma8EntityReference = z.infer<typeof EntityReferenceSchema>;

export const ScalarTypeSchema = z.object({
  kind: z.literal("scalar"),
  codecId: z.string(),
  typeParams: z.record(z.string(), z.unknown()).optional(),
});

export type Prisma8ScalarType = z.infer<typeof ScalarTypeSchema>;

export const FieldSchema = z.object({
  nullable: z.boolean(),
  many: z.literal(true).optional(),
  type: ScalarTypeSchema,
  valueSet: EntityReferenceSchema.optional(),
});

export type Prisma8Field = z.infer<typeof FieldSchema>;

export const ModelSchema = z.object({
  fields: z.record(z.string(), FieldSchema),
  relations: z.record(z.string(), z.unknown()).optional(),
  storage: z.object({
    namespaceId: z.string(),
    table: z.string(),
    fields: z.record(z.string(), z.object({ column: z.string() })),
  }),
});

export type Prisma8Model = z.infer<typeof ModelSchema>;

export const StorageColumnSchema = z.object({
  codecId: z.string(),
  nullable: z.boolean(),
  many: z.literal(true).optional(),
  valueSet: EntityReferenceSchema.optional(),
});

export type Prisma8StorageColumn = z.infer<typeof StorageColumnSchema>;

export const StorageNamespaceSchema = z.object({
  entries: z.object({
    table: z.record(
      z.string(),
      z.object({ columns: z.record(z.string(), StorageColumnSchema) }),
    ).optional(),
    valueSet: z.record(
      z.string(),
      z.object({ values: z.array(z.unknown()) }),
    ).optional(),
  }).loose(),
});

export type Prisma8StorageNamespace = z.infer<typeof StorageNamespaceSchema>;

export const DomainEnumSchema = z.object({
  codecId: z.string(),
  members: z.array(z.object({ name: z.string(), value: z.unknown() })),
});

export type Prisma8DomainEnum = z.infer<typeof DomainEnumSchema>;

export const Prisma8ContractSchema = z.object({
  schemaVersion: z.string(),
  targetFamily: z.literal("sql"),
  target: z.literal("postgres"),
  roots: z.record(
    z.string(),
    z.object({ namespace: z.string(), model: z.string() }),
  ),
  domain: z.object({
    namespaces: z.record(
      z.string(),
      z.object({
        models: z.record(z.string(), ModelSchema),
        enum: z.record(z.string(), DomainEnumSchema).optional(),
      }).loose(),
    ),
  }),
  storage: z.object({
    namespaces: z.record(z.string(), StorageNamespaceSchema),
  }).loose(),
}).loose();

export type Prisma8Contract = z.infer<typeof Prisma8ContractSchema>;
