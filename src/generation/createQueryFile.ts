import type { GenerationOptions } from "../schemas/config.schema.js";
import type { Endpoint } from "../types/Endpoint.js";
import { getSchemaReference, joinLines, joinSections, renderFileHeader, renderImport } from "./util/codegen.js";
import { getEndpointShape } from "./util/getEndpointShape.js";

/**
 * Generates the file for a GET endpoint. Every file exports a plain fetcher
 * and a query key builder (no React); the `hooks` and `exportQueryOptions`
 * options add the suspense hook and queryOptions factory on top, both built
 * from the fetcher and key builder.
 */
export const createQueryFile = (endpoint: Endpoint, options: GenerationOptions, nestingLevel: number): string => {
  const shape = getEndpointShape(endpoint);

  if (!shape || shape.kind !== "query") {
    throw new Error(`Cannot create a query file for ${endpoint.method} ${endpoint.path}`);
  }

  const { schemaPackage, hooks, exportQueryOptions } = options;
  const { operationId, path } = endpoint;
  const { fetcherName, inputTypeName, params, query, hasInput } = shape;

  const nesting = "../".repeat(nestingLevel);

  const responseSchema = endpoint.response[200] || endpoint.response[201] || endpoint.response[204] || "z.any()";
  const paramsSchema = params ? getSchemaReference(params, "ParamsSchema") : null;
  const querySchema = query ? getSchemaReference(query, "QuerySchema") : null;
  const responseRef = getSchemaReference(responseSchema, "ResponseSchema");
  const responseType = `z.infer<typeof ${responseRef.ref}>`;

  const inputParam = hasInput ? `input: ${inputTypeName}` : null;
  const inputArg = hasInput ? "input" : "";
  const destructure = hasInput
    ? `  const { ${[paramsSchema && "params", querySchema && "query"].filter(Boolean).join(", ")} } = input;\n`
    : null;
  const url = paramsSchema
    ? `injectParams("${path}", ${paramsSchema.ref}, params)`
    : `"${path}"`;

  const imports = joinLines([
    renderImport(
      "@tanstack/react-query",
      [
        ...(exportQueryOptions ? ["queryOptions"] : []),
        ...(hooks ? ["useSuspenseQuery"] : []),
      ],
      ["QueryKey", ...(hooks ? ["UseSuspenseQueryOptions"] : [])],
    ),
    renderImport("axios", [], ["AxiosInstance"]),
    hooks && renderImport("type-fest", [], ["Except"]),
    'import z from "zod/v4";',
    renderImport(schemaPackage, [...new Set(endpoint.schemaImports)]),
    renderImport(`${nesting}util`, [
      "buildQueryKey",
      ...(paramsSchema ? ["injectParams"] : []),
      ...(querySchema ? ["serializeSearchQuery"] : []),
      ...(hooks ? ["useAxiosInstance"] : []),
    ]),
  ]);

  const schemaConsts = joinLines([
    paramsSchema?.declaration,
    querySchema?.declaration,
    responseRef.declaration,
  ]);

  const inputType = hasInput && joinLines([
    `export type ${inputTypeName} = {`,
    paramsSchema && `  params: z.output<typeof ${paramsSchema.ref}>;`,
    querySchema && `  query: z.input<typeof ${querySchema.ref}>;`,
    "};",
  ]);

  const queryKeyBuilder = hasInput
    ? joinLines([
      `export const ${fetcherName}QueryKey = (${inputParam}): QueryKey => {`,
      destructure,
      `  return buildQueryKey(${url}${querySchema ? ", query" : ""});`,
      "};",
    ])
    : `export const ${fetcherName}QueryKey = (): QueryKey => buildQueryKey(${url});`;

  const fetcher = joinLines([
    `export const ${fetcherName} = async (${["axios: AxiosInstance", inputParam, "config?: { signal?: AbortSignal }"].filter(Boolean).join(", ")}): Promise<${responseType}> => {`,
    destructure,
    `  const url = ${url};`,
    querySchema && "  const searchQuery = serializeSearchQuery(query);",
    "",
    `  const response = await axios.get(${querySchema ? "`${url}?${searchQuery}`" : "url"}, {`,
    "    signal: config?.signal,",
    "  });",
    "",
    `  return ${responseRef.ref}.parse(response.data);`,
    "};",
  ]);

  const fetcherCall = `${fetcherName}(${["axios", inputArg].filter(Boolean).join(", ")}, { signal: context.signal })`;

  const queryOptionsFactory = exportQueryOptions && joinLines([
    `export const ${fetcherName}QueryOptions = (${["axios: AxiosInstance", inputParam].filter(Boolean).join(", ")}) => queryOptions({`,
    `  queryKey: ${fetcherName}QueryKey(${inputArg}),`,
    `  queryFn: (context) => ${fetcherCall},`,
    "});",
  ]);

  const hook = hooks && joinLines([
    `export const use${operationId}SuspenseQuery = (${[inputParam, `options?: Except<UseSuspenseQueryOptions<${responseType}>, "queryFn">`].filter(Boolean).join(", ")}) => {`,
    "  const axios = useAxiosInstance();",
    "",
    "  return useSuspenseQuery({",
    ...(exportQueryOptions
      ? [`    ...${fetcherName}QueryOptions(${["axios", inputArg].filter(Boolean).join(", ")}),`]
      : [
        `    queryKey: ${fetcherName}QueryKey(${inputArg}),`,
        `    queryFn: (context) => ${fetcherCall},`,
      ]),
    "    ...options,",
    "  });",
    "};",
  ]);

  return joinSections([
    joinLines([renderFileHeader("query", endpoint.method, path), imports]),
    schemaConsts,
    inputType,
    queryKeyBuilder,
    fetcher,
    queryOptionsFactory,
    hook,
  ]);
};
