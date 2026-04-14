import type { Config } from "../schemas/config.schema.js";
import type { Endpoint } from "../types/Endpoint.js";
import { compileTemplate } from "./compileTemplate.js";
import { loadTemplateFile } from "./loadTemplateFile.js";
import { isComplexSchema } from "./util/isComplexSchema.js";

export const createMutationFile = (endpoint: Endpoint, config: Config, nestingLevel: number): string => {
  const { schemaPackage } = config;
  const { body, params, schemaImports, response } = endpoint;
  const supportsBody = endpoint.method !== "DELETE";
  const effectiveBody = supportsBody ? body : undefined;

  let templateFile: string;

  if (effectiveBody && params) {
    templateFile = "mutation-with-body-and-params.ts.template";
  }
  else if (params) {
    templateFile = "mutation-with-params.ts.template";
  }
  else if (effectiveBody) {
    templateFile = "mutation-with-body.ts.template";
  }
  else {
    templateFile = "mutation-basic.ts.template";
  }

  const template = loadTemplateFile(templateFile);

  const nesting = "../".repeat(nestingLevel);

  const responseSchema = response[200] || response[201] || response[202] || response[204];
  const hasResponseSchema = Boolean(responseSchema);
  const isResponseComplex = isComplexSchema(responseSchema);
  const isBodyComplex = isComplexSchema(effectiveBody);
  const isParamsComplex = isComplexSchema(params);

  const responseSchemaRef = hasResponseSchema
    ? isResponseComplex
      ? "ResponseSchema"
      : responseSchema
    : undefined;

  const axiosRequestWithBody = `axios.${endpoint.method.toLowerCase()}(urlWithParams, body)`;

  const axiosRequestBodyOnly = `axios.${endpoint.method.toLowerCase()}(url, body)`;

  const axiosRequestParamsOnly = `axios.${endpoint.method.toLowerCase()}(urlWithParams)`;
  const axiosRequestBasic = `axios.${endpoint.method.toLowerCase()}(url)`;
  const axiosRequest = effectiveBody && params
    ? axiosRequestWithBody
    : params
      ? axiosRequestParamsOnly
      : effectiveBody
        ? axiosRequestBodyOnly
        : axiosRequestBasic;
  const mutation_request_statement = responseSchemaRef
    ? `const response = await ${axiosRequest};`
    : `await ${axiosRequest};`;
  const mutation_return_statement = responseSchemaRef
    ? `return ${responseSchemaRef}.parse(response.data);`
    : "return undefined;";

  return compileTemplate(template, {
    method: endpoint.method,
    method_lower: endpoint.method.toLowerCase(),
    path: endpoint.path,
    identifier: endpoint.operationId,
    schema_imports: [...new Set(schemaImports)].join(", "),
    schema_package: schemaPackage,
    nesting,
    body_schema: effectiveBody,
    body_schema_const: isBodyComplex
      ? `const BodySchema = ${effectiveBody};`
      : "",
    body_schema_ref: isBodyComplex
      ? "BodySchema"
      : effectiveBody,
    params_schema: params,
    params_schema_const: isParamsComplex
      ? `const ParamsSchema = ${params};`
      : "",
    params_schema_ref: isParamsComplex
      ? "ParamsSchema"
      : params,
    response_schema: responseSchema,
    response_schema_const: hasResponseSchema
      ? isResponseComplex
        ? `const ResponseSchema = ${responseSchema};`
        : ""
      : "",
    response_schema_ref: responseSchemaRef,
    mutation_response_type: responseSchemaRef
      ? `z.output<typeof ${responseSchemaRef}>`
      : "undefined",
    mutation_request_statement,
    mutation_return_statement,
    axios_request_with_body: axiosRequestWithBody,
    axios_request_body_only: axiosRequestBodyOnly,
    axios_request_params_only: axiosRequestParamsOnly,
    axios_request_basic: axiosRequestBasic,
  });
};