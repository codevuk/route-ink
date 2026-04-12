export type Endpoint = {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
  path: string;
  operationId: string;
  schemaImports: string[];
  description?: string;
  query?: string | undefined;
  params?: string | undefined;
  body?: string | undefined;
  response: {
    [statusCode: number]: string;
  }
}