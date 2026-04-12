export type Endpoint = {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
  operationId: string;
  description?: string;
  query?: string;
  params?: string;
  body?: string;
  response: {
    [statusCode: number]: string;
  }
}