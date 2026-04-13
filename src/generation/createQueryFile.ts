import type { Config } from "../schemas/config.schema.js";
import type { Endpoint } from "../types/Endpoint.js";
import { compileTemplate } from "./compileTemplate.js";
import { loadTemplateFile } from "./loadTemplateFile.js";

export const createQueryFile = (endpoint: Endpoint, config: Config, nestingLevel: number): string => {
  const { schemaPackage } = config;
  const { query, params, schemaImports, response } = endpoint;

  let templateFile: string | null = null;

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
    return "";
  }

  if (!templateFile) {
    return "";
  }

  const template = loadTemplateFile(templateFile);

  const nesting = "../".repeat(nestingLevel);

  return compileTemplate(template, {
    method: endpoint.method,
    path: endpoint.path,
    identifier: endpoint.operationId,
    schema_imports: [...new Set(schemaImports)].join(", "),
    schema_package: schemaPackage,
    nesting,
    query_schema: query,
    params_schema: params,
    response_schema: response[200] || response[201] || response[204] || "z.any()",
  });
}