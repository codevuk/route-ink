import type { Prisma8Config } from "../prisma8-config.schema.js";
import type { Prisma8Contract, Prisma8Field, Prisma8Model } from "../prisma8-contract.schema.js";
import type { PrismaEnum, PrismaModel } from "../types/PrismaModel.js";
import { expandNamingPattern } from "../util/expandNamingPattern.js";
import {
  mapPrisma8CodecToZod,
  parseCodecId,
  type Prisma8CodecMapping,
} from "./mapPrisma8CodecToZod.js";

type EnumReference = {
  namespace: string;
  name: string;
};

type FieldMapping = {
  expression: string;
  enumReference: EnumReference | null;
  temporalImport: string | null;
};

const prisma8FieldOrder = (a: string, b: string): number => {
  const rank = (name: string): number => {
    if (name === "id") {
      return 0;
    }

    if (name === "createdAt") {
      return 2;
    }

    if (name === "updatedAt") {
      return 3;
    }

    return 1;
  };

  const rankDifference = rank(a) - rank(b);

  return rankDifference !== 0 ? rankDifference : a.localeCompare(b);
};

const storageValueSetRef = (
  contract: Prisma8Contract,
  model: Prisma8Model,
  fieldName: string,
): EnumReference | undefined => {
  const fieldStorage = model.storage.fields[fieldName];

  if (!fieldStorage) {
    return undefined;
  }

  const table = contract.storage.namespaces[model.storage.namespaceId]
    ?.entries.table?.[model.storage.table];
  const valueSet = table?.columns[fieldStorage.column]?.valueSet;

  return valueSet ? { namespace: valueSet.namespaceId, name: valueSet.entityName } : undefined;
};

const enumReferenceForField = (
  contract: Prisma8Contract,
  namespaceName: string,
  model: Prisma8Model,
  fieldName: string,
  field: Prisma8Field,
): EnumReference | undefined => {
  if (field.valueSet) {
    return { namespace: field.valueSet.namespaceId, name: field.valueSet.entityName };
  }

  const fromStorage = storageValueSetRef(contract, model, fieldName);

  if (fromStorage) {
    return fromStorage;
  }

  // Inline enums carry their name in `typeParams` with no namespace of their
  // own — they belong to the namespace that declares the model.
  const typeName = field.type.typeParams?.typeName;

  return typeof typeName === "string" && parseCodecId(field.type.codecId).name === "enum"
    ? { namespace: namespaceName, name: typeName }
    : undefined;
};

const fieldToZod = (
  contract: Prisma8Contract,
  namespaceName: string,
  model: Prisma8Model,
  fieldName: string,
  field: Prisma8Field,
  config: Prisma8Config,
): FieldMapping => {
  if (field.type.kind !== "scalar") {
    throw new Error(
      `Unsupported Prisma 8 field kind '${field.type.kind}' for field '${fieldName}'`,
    );
  }

  const enumReference = enumReferenceForField(contract, namespaceName, model, fieldName, field);
  const mapped: Prisma8CodecMapping = enumReference
    ? { expression: expandNamingPattern(config.enumSchemaNaming, enumReference.name, "enum") }
    : mapPrisma8CodecToZod(field.type.codecId, config);

  let expression = mapped.expression;

  if (field.many) {
    expression = `z.array(${expression})`;
  }

  if (field.nullable) {
    expression += config.nullStrategy === "nullish" ? ".nullish()" : ".nullable()";
  }

  return {
    expression,
    enumReference: enumReference ?? null,
    temporalImport: mapped.temporalImport ?? null,
  };
};

const authoredModelCoordinates = (contract: Prisma8Contract): Set<string> => {
  const result = new Set<string>();

  for (const [accessor, coordinate] of Object.entries(contract.roots)) {
    // Prisma 8 emits implicit junction roots such as `_PostToTag` whose model
    // coordinate is `PostToTag`. Prisma 7 DMMF did not expose those as models.
    // Ordinary root/accessor names are not required to equal the domain model
    // name, so a name mismatch alone must not exclude an authored model.
    if (accessor.startsWith("_") && accessor !== coordinate.model) {
      continue;
    }

    result.add(`${coordinate.namespace}\0${coordinate.model}`);
  }

  return result;
};

const assertStringValues = (values: unknown[], enumName: string): string[] => {
  if (!values.every((value): value is string => typeof value === "string")) {
    throw new Error(`Prisma 8 enum '${enumName}' contains a non-string value`);
  }

  return values;
};

const enumValuesInNamespace = (
  contract: Prisma8Contract,
  namespaceName: string,
  enumName: string,
): string[] | undefined => {
  const domainEnum = contract.domain.namespaces[namespaceName]?.enum?.[enumName];

  if (domainEnum) {
    return assertStringValues(domainEnum.members.map((member) => member.value), enumName);
  }

  const valueSet = contract.storage.namespaces[namespaceName]?.entries.valueSet?.[enumName];

  return valueSet ? assertStringValues(valueSet.values, enumName) : undefined;
};

/**
 * Resolves an enum by its declared namespace, falling back to a scan when the
 * reference points at a storage namespace whose name differs from the domain
 * one. An ambiguous fallback is an error rather than a silent pick, because
 * generated enum files are keyed by bare name and would overwrite each other.
 */
const resolveEnumValues = (
  contract: Prisma8Contract,
  reference: EnumReference,
): string[] => {
  const direct = enumValuesInNamespace(contract, reference.namespace, reference.name);

  if (direct) {
    return direct;
  }

  const namespaceNames = new Set([
    ...Object.keys(contract.domain.namespaces),
    ...Object.keys(contract.storage.namespaces),
  ]);
  const matches: Array<{ namespace: string; values: string[] }> = [];

  for (const namespaceName of namespaceNames) {
    const values = enumValuesInNamespace(contract, namespaceName, reference.name);

    if (values) {
      matches.push({ namespace: namespaceName, values });
    }
  }

  if (matches.length === 0) {
    throw new Error(`Could not resolve Prisma 8 enum values for '${reference.name}'`);
  }

  if (matches.length > 1) {
    const namespaces = matches.map((match) => match.namespace).sort().join(", ");

    throw new Error(
      `Ambiguous Prisma 8 enum name '${reference.name}' declared in namespaces: ${namespaces}`,
    );
  }

  return matches[0]!.values;
};

export const parsePrisma8Contract = (
  contract: Prisma8Contract,
  config: Prisma8Config,
): { models: PrismaModel[]; enums: PrismaEnum[] } => {
  const authoredModels = authoredModelCoordinates(contract);
  const models: PrismaModel[] = [];
  const usedEnums = new Map<string, EnumReference>();
  const seenModels = new Set<string>();

  for (const [namespaceName, namespace] of Object.entries(contract.domain.namespaces)) {
    for (const [modelName, model] of Object.entries(namespace.models)) {
      if (!authoredModels.has(`${namespaceName}\0${modelName}`)) {
        continue;
      }

      if (seenModels.has(modelName)) {
        throw new Error(`Duplicate Prisma 8 model name across namespaces: ${modelName}`);
      }

      seenModels.add(modelName);

      // Tracked per model: deriving imports from the global set by substring
      // matching leaks `RoleSchema` into models that only use `UserRoleSchema`.
      const enumImports = new Set<string>();
      const temporalImports = new Set<string>();

      const fields = Object.entries(model.fields)
        .sort(([a], [b]) => prisma8FieldOrder(a, b))
        .map(([fieldName, field]) => {
          const mapped = fieldToZod(contract, namespaceName, model, fieldName, field, config);

          if (mapped.enumReference) {
            const { name } = mapped.enumReference;
            const previous = usedEnums.get(name);

            if (previous && previous.namespace !== mapped.enumReference.namespace) {
              throw new Error(`Duplicate Prisma 8 enum name across namespaces: ${name}`);
            }

            usedEnums.set(name, mapped.enumReference);
            enumImports.add(name);
          }

          if (mapped.temporalImport) {
            temporalImports.add(mapped.temporalImport);
          }

          return { name: fieldName, zodExpression: mapped.expression };
        });

      models.push({
        name: modelName,
        fields,
        enumImports: Array.from(enumImports).sort(),
        temporalImport: temporalImports.size > 0
          ? {
              module: config.temporalImportModule,
              symbols: Array.from(temporalImports).sort(),
            }
          : null,
      });
    }
  }

  const enums = Array.from(usedEnums.values())
    .map((reference) => ({ name: reference.name, values: resolveEnumValues(contract, reference) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { models, enums };
};
