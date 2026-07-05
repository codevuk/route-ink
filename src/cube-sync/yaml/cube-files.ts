import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import type { ParsedNode, Scalar, YAMLMap, YAMLSeq } from "yaml";
import { normalizeTableName } from "../parsing/normalize.js";
import type {
  CubeDefinition,
  CubeDimension,
  CubeFile,
  CubeJoin,
  CubeMeasure,
  CubeRelationshipMeta,
} from "../types.js";

const asScalarString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

const getMapValue = (map: YAMLMap, key: string): unknown => {
  return map.get(key);
};

const getSeq = (map: YAMLMap, key: string): YAMLSeq | undefined => {
  const value = map.get(key, true);
  return isSeq(value) ? value : undefined;
};

const getMap = (map: YAMLMap, key: string): YAMLMap | undefined => {
  const value = map.get(key, true);
  return isMap(value) ? value : undefined;
};

const parseStringArray = (value: unknown): string[] | undefined => {
  if (!isSeq(value)) {
    return undefined;
  }

  const values: string[] = [];

  for (const item of value.items) {
    const jsonValue = typeof item === "object"
      && item !== null
      && "toJSON" in item
      && typeof item.toJSON === "function"
      ? item.toJSON()
      : undefined;
    if (typeof jsonValue === "string") {
      values.push(jsonValue);
    }
  }

  return values;
};

const parseDimensions = (cubeMap: YAMLMap, cubePath: Array<string | number>): CubeDimension[] => {
  const dimensions = getSeq(cubeMap, "dimensions");

  if (!dimensions) {
    return [];
  }

  return dimensions.items.flatMap((item, index) => {
    if (!isMap(item)) {
      return [];
    }

    const meta = getMap(item, "meta");

    return [{
      name: asScalarString(getMapValue(item, "name")) ?? `#${index + 1}`,
      sql: asScalarString(getMapValue(item, "sql")),
      metaEnum: meta ? parseStringArray(meta.get("enum", true)) : undefined,
      path: [...cubePath, "dimensions", index],
    }];
  });
};

const parseMeasures = (cubeMap: YAMLMap, cubePath: Array<string | number>): CubeMeasure[] => {
  const measures = getSeq(cubeMap, "measures");

  if (!measures) {
    return [];
  }

  return measures.items.flatMap((item, index) => {
    if (!isMap(item)) {
      return [];
    }

    return [{
      name: asScalarString(getMapValue(item, "name")) ?? `#${index + 1}`,
      sql: asScalarString(getMapValue(item, "sql")),
      path: [...cubePath, "measures", index],
    }];
  });
};

const parseJoins = (cubeMap: YAMLMap, cubePath: Array<string | number>): CubeJoin[] => {
  const joins = getSeq(cubeMap, "joins");

  if (!joins) {
    return [];
  }

  return joins.items.flatMap((item, index) => {
    if (!isMap(item)) {
      return [];
    }

    return [{
      name: asScalarString(getMapValue(item, "name")) ?? `#${index + 1}`,
      relationship: asScalarString(getMapValue(item, "relationship")),
      path: [...cubePath, "joins", index],
    }];
  });
};

const parseRelationships = (cubeMap: YAMLMap, cubePath: Array<string | number>): CubeRelationshipMeta[] => {
  const meta = getMap(cubeMap, "meta");
  const relationships = meta ? getSeq(meta, "relationships") : undefined;

  if (!relationships) {
    return [];
  }

  return relationships.items.flatMap((item, index) => {
    if (!isMap(item)) {
      return [];
    }

    return [{
      cube: asScalarString(getMapValue(item, "cube")),
      type: asScalarString(getMapValue(item, "type")),
      note: getMapValue(item, "note"),
      path: [...cubePath, "meta", "relationships", index],
    }];
  });
};

const parseCubes = (filePath: string, doc: CubeFile["doc"]): CubeDefinition[] => {
  const contents = doc.contents as ParsedNode;

  if (!isMap(contents)) {
    return [];
  }

  const cubes = contents.get("cubes", true);

  if (!isSeq(cubes)) {
    return [];
  }

  return cubes.items.flatMap((item, index) => {
    if (!isMap(item)) {
      return [];
    }

    const cubePath = ["cubes", index];
    const name = asScalarString(getMapValue(item, "name")) ?? `#${index + 1}`;
    const sqlTable = asScalarString(getMapValue(item, "sql_table"));

    if (!sqlTable) {
      return [];
    }

    return [{
      name,
      sqlTable,
      normalizedTable: normalizeTableName(sqlTable),
      filePath,
      cubeIndex: index,
      path: cubePath,
      dimensions: parseDimensions(item, cubePath),
      measures: parseMeasures(item, cubePath),
      joins: parseJoins(item, cubePath),
      relationships: parseRelationships(item, cubePath),
    }];
  });
};

type BlockScalarSource = {
  path: Array<string | number>;
  header: string;
  source: string;
};

const scalarKeyValue = (key: unknown): string | number | undefined => {
  if (!isScalar(key)) {
    return undefined;
  }

  const value = key.value;
  return typeof value === "string" || typeof value === "number" ? value : undefined;
};

const collectBlockScalarSources = (
  node: unknown,
  path: Array<string | number> = [],
): BlockScalarSource[] => {
  if (isScalar(node)) {
    const scalar = node as Scalar & {
      srcToken?: {
        type?: string;
        props?: Array<{ source: string }>;
        source?: string;
      };
    };

    const srcToken = scalar.srcToken as
      | {
        type?: string;
        props?: Array<{ source?: string }>;
        source?: string;
      }
      | undefined;

    if (srcToken?.type === "block-scalar" && srcToken.source !== undefined) {
      return [{
        path,
        header: srcToken.props?.map((prop) => prop.source ?? "").join("") ?? "",
        source: srcToken.source,
      }];
    }

    return [];
  }

  if (isSeq(node)) {
    return node.items.flatMap((item, index) => collectBlockScalarSources(item, [...path, index]));
  }

  if (isMap(node)) {
    return node.items.flatMap((pair) => {
      const key = scalarKeyValue(pair.key);
      return key === undefined ? [] : collectBlockScalarSources(pair.value, [...path, key]);
    });
  }

  return [];
};

const restoreBlockScalarSources = (originalSource: string, generatedSource: string): string => {
  const originalDoc = parseDocument(originalSource, { keepSourceTokens: true });
  const generatedDoc = parseDocument(generatedSource, { keepSourceTokens: true });
  const originalBlocks = collectBlockScalarSources(originalDoc.contents);
  const replacements = originalBlocks.flatMap((block) => {
    const generatedNode = generatedDoc.getIn(block.path, true);

    if (!isScalar(generatedNode)) {
      return [];
    }

    const generatedScalar = generatedNode as Scalar & {
      range?: [number, number, number];
      srcToken?: {
        type?: string;
        offset?: number;
      };
    };

    if (
      generatedScalar.srcToken?.type !== "block-scalar"
      || generatedScalar.srcToken.offset === undefined
      || generatedScalar.range === undefined
    ) {
      return [];
    }

    return [{
      start: generatedScalar.srcToken.offset,
      end: generatedScalar.range[1],
      value: `${block.header}${block.source}`,
    }];
  });

  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce((source, replacement) => (
      `${source.slice(0, replacement.start)}${replacement.value}${source.slice(replacement.end)}`
    ), generatedSource);
};

const restoreTrailingNewlines = (originalSource: string, generatedSource: string): string => {
  const originalTrailingNewlines = originalSource.match(/\n+$/)?.[0] ?? "";
  return `${generatedSource.replace(/\n+$/, "")}${originalTrailingNewlines}`;
};

const restoreTrailingWhitespace = (originalSource: string, generatedSource: string): string => {
  const originalLines = originalSource.split("\n");
  const generatedLines = generatedSource.split("\n");
  const originalLinesByTrimmed = new Map<string, string | undefined>();

  for (const line of originalLines) {
    if (!/[ \t]+$/.test(line)) {
      continue;
    }

    const trimmed = line.trimEnd();
    const existing = originalLinesByTrimmed.get(trimmed);
    if (existing === undefined) {
      originalLinesByTrimmed.set(trimmed, line);
    } else if (existing !== line) {
      originalLinesByTrimmed.set(trimmed, undefined);
    }
  }

  return generatedLines
    .map((line) => {
      if (/[ \t]+$/.test(line)) {
        return line;
      }

      const originalLine = originalLinesByTrimmed.get(line.trimEnd());
      return originalLine ?? line;
    })
    .join("\n");
};

export const readCubeFiles = (cubeModelDir: string): CubeFile[] => {
  if (!existsSync(cubeModelDir)) {
    throw new Error(`Cube model directory does not exist: ${cubeModelDir}`);
  }

  return readdirSync(cubeModelDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const filePath = join(cubeModelDir, entry.name);
      const source = readFileSync(filePath, "utf8");
      const doc = parseDocument(source, { keepSourceTokens: true });
      return {
        filePath,
        source,
        doc,
        cubes: parseCubes(filePath, doc),
        changed: false,
      };
    });
};

export const refreshCubeFile = (cubeFile: CubeFile): void => {
  cubeFile.cubes = parseCubes(cubeFile.filePath, cubeFile.doc);
};

export const writeChangedCubeFiles = (cubeFiles: CubeFile[]): number => {
  let count = 0;

  for (const cubeFile of cubeFiles) {
    if (!cubeFile.changed) {
      continue;
    }

    const generatedSource = cubeFile.doc.toString({ lineWidth: 0 });
    const restoredSource = restoreBlockScalarSources(cubeFile.source, generatedSource);
    const whitespaceRestoredSource = restoreTrailingWhitespace(cubeFile.source, restoredSource);
    writeFileSync(cubeFile.filePath, restoreTrailingNewlines(cubeFile.source, whitespaceRestoredSource));
    count += 1;
  }

  return count;
};
