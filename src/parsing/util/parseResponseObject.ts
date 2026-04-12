export function parseResponseObject(responseObj: Record<string, string>): Record<number, string> {
  const result: Record<number, string> = {};

  for (const [statusCodeStr, value] of Object.entries(responseObj)) {
    const statusCode = parseInt(statusCodeStr, 10);

    if (isNaN(statusCode)) {
      console.warn(`Invalid status code '${statusCodeStr}' in response object — skipping`);
      continue;
    }

    result[statusCode] = value;
  }

  return result;
}