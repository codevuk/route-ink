import type { Config } from "../schemas/config.schema.js";
import type { Endpoint } from "../types/Endpoint.js";
import { cleanupImports } from "./util/cleanupImports.js";
import { compileTemplate } from "./compileTemplate.js";
import { loadTemplateFile } from "./loadTemplateFile.js";
import { isComplexSchema } from "./util/isComplexSchema.js";

export const createQueryFile = (endpoint: Endpoint, config: Config, nestingLevel: number): string => {
  const { schemaPackage } = config;
  const { query, params, schemaImports, response } = endpoint;

  let templateFile: string;

  if (params && query) {
    templateFile = "get-with-query-and-params.ts.template";
  }
  else if (query) {
    templateFile = "get-with-query.ts.template";
  }
  else if (params) {
    templateFile = "get-with-params.ts.template";
  }
  else {
    templateFile = "get-basic.ts.template";
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