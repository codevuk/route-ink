import type { DMMF, GeneratorOptions } from "@prisma/generator-helper";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCubeSync } from "../../cube-sync/actions/generate-cube-sync.js";

const createField = (field: Partial<DMMF.Field>): DMMF.Field => field as DMMF.Field;

const baseDmmf = (): DMMF.Document => ({
  datamodel: {
    enums: [
      {
        name: "SubscriptionStatus",
        values: [
          { name: "ACTIVE", dbName: null },
          { name: "PAUSED", dbName: null },
          { name: "CANCELLED", dbName: null },
        ],
        dbName: null,
      },
    ],
    models: [
      {
        name: "Customer",
        dbName: "customer",
        fields: [
          createField({ name: "id", dbName: null, kind: "scalar", type: "Int" }),
          createField({ name: "addresses", kind: "object", type: "CustomerAddress", relationName: "CustomerToAddress" }),
        ],
      },
      {
        name: "CustomerAddress",
        dbName: "customer_address",
        fields: [
          createField({ name: "id", dbName: null, kind: "scalar", type: "Int" }),
          createField({ name: "customerId", dbName: "customer_id", kind: "scalar", type: "Int" }),
          createField({ name: "customer", kind: "object", type: "Customer", relationName: "CustomerToAddress" }),
        ],
      },
      {
        name: "SubscriptionPlan",
        dbName: "subscription_plan",
        fields: [
          createField({ name: "id", dbName: null, kind: "scalar", type: "Int" }),
          createField({ name: "status", dbName: null, kind: "enum", type: "SubscriptionStatus" }),
        ],
      },
    ],
    types: [],
  },
  schema: {
    inputObjectTypes: { model: [], prisma: [] },
    outputObjectTypes: { model: [], prisma: [] },
    enumTypes: { model: [], prisma: [] },
    fieldRefTypes: { prisma: [] },
  },
  mappings: {
    modelOperations: [],
    otherOperations: { read: [], write: [] },
  },
}) as unknown as DMMF.Document;

const coverageDmmf = (): DMMF.Document => ({
  datamodel: {
    enums: [],
    models: [
      {
        name: "Product",
        dbName: "product",
        fields: [
          createField({ name: "id", dbName: null, kind: "scalar", type: "Int" }),
          createField({ name: "name", dbName: null, kind: "scalar", type: "String" }),
          createField({ name: "currentPrice", dbName: "current_price", kind: "scalar", type: "Int" }),
          createField({ name: "category", kind: "object", type: "Category", relationName: "CategoryToProduct" }),
        ],
      },
      {
        name: "Category",
        dbName: "category",
        fields: [
          createField({ name: "id", dbName: null, kind: "scalar", type: "Int" }),
          createField({ name: "products", kind: "object", type: "Product", relationName: "CategoryToProduct" }),
        ],
      },
      {
        name: "HiddenModel",
        dbName: "hidden_model",
        fields: [
          createField({ name: "id", dbName: null, kind: "scalar", type: "Int" }),
        ],
      },
    ],
    types: [],
  },
  schema: {
    inputObjectTypes: { model: [], prisma: [] },
    outputObjectTypes: { model: [], prisma: [] },
    enumTypes: { model: [], prisma: [] },
    fieldRefTypes: { prisma: [] },
  },
  mappings: {
    modelOperations: [],
    otherOperations: { read: [], write: [] },
  },
}) as unknown as DMMF.Document;

const createOptions = (schemaPath: string, dmmf: DMMF.Document): GeneratorOptions => ({
  schemaPath,
  dmmf,
  generator: {
    name: "cubeSchema",
    provider: { value: "route-ink-cube-sync-generator", fromEnvVar: null },
    output: { value: "./generated", fromEnvVar: null },
    config: {
      cubeModelDir: "../cubes",
      exceptionsFile: "./cube-schema-parity-exceptions.yml",
    },
    binaryTargets: [],
    previewFeatures: [],
  },
  otherGenerators: [],
  datasources: [],
  version: "0.0.0-test",
}) as unknown as GeneratorOptions;

const createWorkspace = () => {
  const root = mkdtempSync(join(tmpdir(), "route-ink-cube-sync-"));
  const prismaDir = join(root, "prisma");
  const cubeDir = join(root, "cubes");
  return { root, prismaDir, cubeDir, schemaPath: join(prismaDir, "schema.prisma") };
};

const writeFixFixture = (cubeDir: string, prismaDir: string) => {
  writeFileSync(join(prismaDir, "schema.prisma"), "");
  writeFileSync(join(prismaDir, "cube-schema-parity-exceptions.yml"), "tables: []\ncolumns: []\njoins: []\n");
  writeFileSync(join(cubeDir, "customer.yml"), `cubes:
  - name: customer
    sql_table: public.customer
    joins:
      - name: customer_address
        sql: "{CUBE}.id = {customer_address.customer_id}"
        relationship: one_to_many
      - name: subscription_plan
        sql: "{CUBE}.id = {subscription_plan.id}"
        relationship: many_to_one
    dimensions:
      - name: id
        sql: id
        type: number
`);
  writeFileSync(join(cubeDir, "customer_address.yml"), `cubes:
  - name: customer_address
    sql_table: public.customer_address
    description: Customer delivery addresses. City, post code, and country are available for analysis; name, street, and phone are restricted. 
    meta:
      ai_context: >
        Use this cube for geographic analysis — order distribution by city, post code, or country.
        PII fields are hidden from the agent.
      relationships:
        - cube: customer
          type: one_to_one
          note: joining can fan out rows
    joins:
      - name: customer
        sql: "{CUBE}.customer_id = {customer.id}"
        relationship: many_to_one
    dimensions:
      - name: id
        sql: id
        type: number
      - name: customer_id
        sql: "{CUBE}.customer_id"
        type: number
`);
  writeFileSync(join(cubeDir, "subscription_plan.yml"), `cubes:
  - name: subscription_plan
    sql_table: public.subscription_plan
    dimensions:
      - name: id
        sql: id
        type: number
      - name: status
        sql: status
        type: string`);
};

const writeCoverageFixture = (cubeDir: string, prismaDir: string) => {
  writeFileSync(join(prismaDir, "schema.prisma"), "");
  writeFileSync(join(prismaDir, "cube-schema-parity-exceptions.yml"), `tables:
  - table: hidden_model
    reason: intentionally private
columns: []
joins: []
`);
  writeFileSync(join(cubeDir, "product.yml"), `cubes:
  - name: product
    sql_table: public.product
    dimensions:
      - name: id
        sql: id
        type: number
      - name: old_price
        sql: old_price
        type: number
`);
  writeFileSync(join(cubeDir, "category.yml"), `cubes:
  - name: category
    sql_table: public.category
    dimensions:
      - name: id
        sql: id
        type: number
`);
  writeFileSync(join(cubeDir, "stale.yml"), `cubes:
  - name: stale
    sql_table: public.stale
    dimensions:
      - name: id
        sql: id
        type: number
`);
};

describe("generateCubeSync", () => {
  const originalMode = process.env.ROUTE_INK_CUBE_SYNC_MODE;

  afterEach(() => {
    process.env.ROUTE_INK_CUBE_SYNC_MODE = originalMode;
    vi.restoreAllMocks();
  });

  it("patches enum and relationship metadata without touching hand-written notes", async () => {
    const workspace = createWorkspace();
    await import("fs").then(({ mkdirSync }) => {
      mkdirSync(workspace.prismaDir, { recursive: true });
      mkdirSync(workspace.cubeDir, { recursive: true });
    });
    writeFixFixture(workspace.cubeDir, workspace.prismaDir);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const subscriptionPlanBeforeCheck = readFileSync(join(workspace.cubeDir, "subscription_plan.yml"), "utf8");

    process.env.ROUTE_INK_CUBE_SYNC_MODE = "check";
    await expect(generateCubeSync(createOptions(workspace.schemaPath, baseDmmf())))
      .rejects
      .toThrow("Cube schema sync check failed");
    expect(readFileSync(join(workspace.cubeDir, "subscription_plan.yml"), "utf8")).toBe(subscriptionPlanBeforeCheck);

    process.env.ROUTE_INK_CUBE_SYNC_MODE = "fix";
    await generateCubeSync(createOptions(workspace.schemaPath, baseDmmf()));

    const subscriptionPlan = readFileSync(join(workspace.cubeDir, "subscription_plan.yml"), "utf8");
    const customerAddress = readFileSync(join(workspace.cubeDir, "customer_address.yml"), "utf8");

    expect(subscriptionPlan).toContain(`meta:
          enum:
            - ACTIVE
            - PAUSED
            - CANCELLED`);
    expect(subscriptionPlan.endsWith("\n")).toBe(false);
    expect(customerAddress).toContain("description: Customer delivery addresses. City, post code, and country are available for analysis; name, street, and phone are restricted. \n");
    expect(customerAddress).toContain(`ai_context: >
        Use this cube for geographic analysis — order distribution by city, post code, or country.
        PII fields are hidden from the agent.`);
    expect(customerAddress).toContain("type: many_to_one");
    expect(customerAddress).toContain("note: joining can fan out rows");
    expect(readFileSync(join(workspace.cubeDir, "customer.yml"), "utf8")).toContain(`relationships:
        - cube: customer_address
          type: one_to_many
        - cube: subscription_plan
          type: many_to_one`);

    process.env.ROUTE_INK_CUBE_SYNC_MODE = "fix";
    await generateCubeSync(createOptions(workspace.schemaPath, baseDmmf()));
    expect(readFileSync(join(workspace.cubeDir, "subscription_plan.yml"), "utf8")).toBe(subscriptionPlan);

    process.env.ROUTE_INK_CUBE_SYNC_MODE = "check";
    await expect(generateCubeSync(createOptions(workspace.schemaPath, baseDmmf()))).resolves.toBeUndefined();
  });

  it("reports coverage findings without writing fixes", async () => {
    const workspace = createWorkspace();
    await import("fs").then(({ mkdirSync }) => {
      mkdirSync(workspace.prismaDir, { recursive: true });
      mkdirSync(workspace.cubeDir, { recursive: true });
    });
    writeCoverageFixture(workspace.cubeDir, workspace.prismaDir);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    process.env.ROUTE_INK_CUBE_SYNC_MODE = "check";

    await expect(generateCubeSync(createOptions(workspace.schemaPath, coverageDmmf())))
      .rejects
      .toThrow("Cube schema sync check failed");
  });
});
