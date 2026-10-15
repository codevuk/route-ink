import type { GenerationOptions } from "../../schemas/config.schema.js";
import type { Endpoint } from "../../types/Endpoint.js";
import { uncapitalize } from "../../util/uncapitalize.js";

export type EndpointKind = "query" | "mutation";

export type EndpointShape = {
  kind: EndpointKind;
  // Plain fetcher name: the operationId with its first letter lowercased
  fetcherName: string;
  inputTypeName: string;
  params: string | undefined;
  query: string | undefined;
  body: string | undefined;
  hasInput: boolean;
};

export type EndpointExport = {
  name: string;
  isType: boolean;
};

export const getEndpointKind = (endpoint: Pick<Endpoint, "method">): EndpointKind | null => {
  if (endpoint.method === "GET") {
    return "query";
  }

  if (endpoint.method === "POST" || endpoint.method === "PUT" || endpoint.method === "PATCH" || endpoint.method === "DELETE") {
    return "mutation";
  }

  return null;
};

export const getEndpointShape = (endpoint: Pick<Endpoint, "method" | "operationId" | "params" | "query" | "body">): EndpointShape | null => {
  const kind = getEndpointKind(endpoint);

  if (!kind) {
    return null;
  }

  const params = endpoint.params;
  // Queries never send a body, mutations never send a query string, and
  // DELETE requests are generated without a body.
  const query = kind === "query" ? endpoint.query : undefined;
  const body = kind === "mutation" && endpoint.method !== "DELETE" ? endpoint.body : undefined;

  return {
    kind,
    fetcherName: uncapitalize(endpoint.operationId),
    inputTypeName: `${endpoint.operationId}Input`,
    params,
    query,
    body,
    hasInput: Boolean(params || query || body),
  };
};

/**
 * Lists every symbol a generated endpoint file exports, so the barrels stay in
 * sync with the file generators.
 */
export const getEndpointExports = (endpoint: Pick<Endpoint, "method" | "operationId" | "params" | "query" | "body">, options: Pick<GenerationOptions, "hooks" | "exportQueryOptions">): EndpointExport[] => {
  const shape = getEndpointShape(endpoint);

  if (!shape) {
    return [];
  }

  const { fetcherName } = shape;
  const names: string[] = [fetcherName];

  if (shape.kind === "query") {
    names.push(`${fetcherName}QueryKey`);

    if (options.exportQueryOptions) {
      names.push(`${fetcherName}QueryOptions`);
    }

    if (options.hooks) {
      names.push(`use${endpoint.operationId}SuspenseQuery`);
    }
  }
  else {
    names.push(`${fetcherName}InvalidationKey`);

    if (options.hooks) {
      names.push(`use${endpoint.operationId}Mutation`);
    }
  }

  const exports: EndpointExport[] = names.map((name) => ({ name, isType: false }));

  if (shape.hasInput) {
    exports.push({ name: shape.inputTypeName, isType: true });
  }

  return exports;
};
