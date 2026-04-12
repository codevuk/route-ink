type ToResult<T> = [Error] | [undefined, T];

export const to = async <T>(promise: Promise<T>): Promise<ToResult<T>> => {
  try {
    const result = await promise;

    return [undefined, result];
  } catch (error) {
    if (error instanceof Error) {
      return [error];
    }

    return [new Error(String(error))];
  }
}