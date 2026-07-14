import type { Config } from "../schemas/config.schema.js";
import type { Endpoint } from "../types/Endpoint.js";
import { cleanupImports } from "./util/cleanupImports.js";
import { compileTemplate } from "./compileTemplate.js";
import { loadTemplateFile } from "./loadTemplateFile.js";
import { isComplexSchema } from "./util/isComplexSchema.js";
import { uncapitalize } from "../util/uncapitalize.js";

export const createQueryFile = (endpoint: Endpoint, config: Config, nestingLevel: number): string => {
  const { schemaPackage, exportQueryOptions } = config;
  const { query, params, schemaImports, response } = endpoint;

  // The "-options" template variants additionally export a queryOptions
  // factory which the suspense hook consumes internally.
  const variant = exportQueryOptions ? "-options" : "";

  let templateFile: string;

  if (params && query) {
    templateFile = `get-with-query-and-params${variant}.ts.template`;
  }
  else if (query) {
    templateFile = `get-with-query${variant}.ts.template`;
  }
  else if (params) {
    templateFile = `get-with-params${variant}.ts.template`;
  }
  else {
    templateFile = `get-basic${variant}.ts.template`;
  }

  const template = loadTemplateFile(templateFile);

  const nesting = "../".repeat(nestingLevel);

  const responseSchema = response[200] || response[201] || response[204] || "z.any()";
  const isResponseComplex = isComplexSchema(responseSchema);

  const isQueryComplex = isComplexSchema(query);
  const isParamsComplex = isComplexSchema(params);

  return cleanupImports(compileTemplate(template, {
    method: endpoint.method,
    path: endpoint.path,
    identifier: endpoint.operationId,
    options_identifier: uncapitalize(endpoint.operationId),
    schema_imports: [...new Set(schemaImports)].join(", "),
    schema_package: schemaPackage,
    nesting,
    query_schema: query,
    params_schema: params,
    response_schema: responseSchema,
    response_schema_const: isResponseComplex
      ? `const ResponseSchema = ${responseSchema};`
      : "",
    response_schema_ref: isResponseComplex
      ? "ResponseSchema"
      : responseSchema,
    query_schema_const: isQueryComplex
      ? `const QuerySchema = ${query};`
      : "",
    query_schema_ref: isQueryComplex
      ? "QuerySchema"
      : query,
    params_schema_const: isParamsComplex
      ? `const ParamsSchema = ${params};`
      : "",
    params_schema_ref: isParamsComplex
      ? "ParamsSchema"
      : params,
  }));
}