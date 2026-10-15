import type { GenerationOptions } from "../schemas/config.schema.js";
import type { Endpoint } from "../types/Endpoint.js";
import { getSchemaReference, joinLines, joinSections, renderFileHeader, renderImport } from "./util/codegen.js";
import { cleanupImports } from "./util/cleanupImports.js";
import { getEndpointShape } from "./util/getEndpointShape.js";

/**
 * Generates the file for a POST/PUT/PATCH/DELETE endpoint. Every file exports
 * a plain fetcher and an invalidation key builder (no React); the `hooks`
 * option adds the mutation hook, built from both.
 */
export const createMutationFile = (endpoint: Endpoint, options: GenerationOptions, nestingLevel: number): string => {
  const shape = getEndpointShape(endpoint);

  if (!shape || shape.kind !== "mutation") {
    throw new Error(`Cannot create a mutation file for ${endpoint.method} ${endpoint.path}`);
  }

  const { schemaPackage, hooks } = options;
  const { operationId, path } = endpoint;
  const { fetcherName, inputTypeName, params, body, hasInput } = shape;

  const nesting = "../".repeat(nestingLevel);

  const responseSchema = endpoint.response[200] || endpoint.response[201] || endpoint.response[202] || endpoint.response[204];
  const paramsSchema = params ? getSchemaReference(params, "ParamsSchema") : null;
  const bodySchema = body ? getSchemaReference(body, "BodySchema") : null;
  const responseRef = responseSchema ? getSchemaReference(responseSchema, "ResponseSchema") : null;
  const responseType = responseRef
    ? `z.output<typeof ${responseRef.ref}>`
    : "undefined";

  const inputParam = hasInput ? `input: ${inputTypeName}` : null;
  const url = paramsSchema
    ? `injectParams("${path}", ${paramsSchema.ref}, params)`
    : `"${path}"`;
  const request = `axios.${endpoint.method.toLowerCase()}(${["url", bodySchema && "body"].filter(Boolean).join(", ")})`;

  const imports = joinLines([
    renderImport(
      "@tanstack/react-query",
      hooks ? ["useMutation", "useQueryClient"] : [],
      ["QueryKey", ...(hooks ? ["UseMutationOptions"] : [])],
    ),
    renderImport("axios", [], ["AxiosInstance"]),
    hooks && renderImport("type-fest", [], ["Except"]),
    'import z from "zod/v4";',
    renderImport(schemaPackage, [...new Set(endpoint.schemaImports)]),
    renderImport(`${nesting}util`, [
      ...(paramsSchema ? ["injectParams"] : []),
      ...(hooks ? ["QueryError", "useAxiosInstance"] : []),
    ]),
  ]);

  const schemaConsts = joinLines([
    paramsSchema?.declaration,
    bodySchema?.declaration,
    responseRef?.declaration,
  ]);

  const inputType = hasInput && joinLines([
    `export type ${inputTypeName} = {`,
    paramsSchema && `  params: z.output<typeof ${paramsSchema.ref}>;`,
    bodySchema && `  body: z.output<typeof ${bodySchema.ref}>;`,
    "};",
  ]);

  const fetcher = joinLines([
    `export const ${fetcherName} = async (${["axios: AxiosInstance", inputParam].filter(Boolean).join(", ")}): Promise<${responseType}> => {`,
    hasInput && `  const { ${[paramsSchema && "params", bodySchema && "body"].filter(Boolean).join(", ")} } = input;\n`,
    `  const url = ${url};`,
    "",
    responseRef
      ? `  const response = await ${request};`
      : `  await ${request};`,
    "",
    responseRef
      ? `  return ${responseRef.ref}.parse(response.data);`
      : "  return undefined;",
    "};",
  ]);

  // The default the mutation hook invalidates: the URL path minus its last
  // segment, e.g. `/users/42/orders` -> ["users", "42"].
  const invalidationKey = paramsSchema
    ? joinLines([
      `export const ${fetcherName}InvalidationKey = (input: Pick<${inputTypeName}, "params">): QueryKey => injectParams("${path}", ${paramsSchema.ref}, input.params)`,
      "  .split(\"/\")",
      "  .filter(Boolean)",
      "  .slice(0, -1);",
    ])
    : joinLines([
      `export const ${fetcherName}InvalidationKey = (): QueryKey => "${path}"`,
      "  .split(\"/\")",
      "  .filter(Boolean)",
      "  .slice(0, -1);",
    ]);

  const hook = hooks && joinLines([
    "type Options = UseMutationOptions<",
    `  ${responseType},`,
    "  QueryError,",
    `  ${hasInput ? inputTypeName : "void"}`,
    "> & {",
    `  queryKeyInvalidation?: string[] | ((response: ${responseType} | undefined) => string[]);`,
    "};",
    "",
    `export const use${operationId}Mutation = (options: Except<Options, "onSettled" | "mutationFn"> = {}) => {`,
    "  const axios = useAxiosInstance();",
    "  const { queryKeyInvalidation } = options;",
    "",
    "  const client = useQueryClient();",
    "",
    "  return useMutation({",
    hasInput
      ? `    mutationFn: (input: ${inputTypeName}) => ${fetcherName}(axios, input),`
      : `    mutationFn: () => ${fetcherName}(axios),`,
    `    onSettled: (${paramsSchema ? "response, _error, variables" : "response"}) => {`,
    "      const invalidationKeys = typeof queryKeyInvalidation === \"function\"",
    "        ? queryKeyInvalidation(response)",
    "        : queryKeyInvalidation;",
    "",
    "      if (invalidationKeys) {",
    "        client.invalidateQueries({ queryKey: invalidationKeys });",
    "        return;",
    "      }",
    "",
    `      client.invalidateQueries({ queryKey: ${fetcherName}InvalidationKey(${paramsSchema ? "variables" : ""}) });`,
    "    },",
    "    ...options,",
    "  });",
    "};",
  ]);

  // `z` is only referenced through schema types, so a mutation without any
  // schema leaves the zod import unused.
  return cleanupImports(joinSections([
    joinLines([renderFileHeader("mutation", endpoint.method, path), imports]),
    schemaConsts,
    inputType,
    fetcher,
    invalidationKey,
    hook,
  ]));
};
