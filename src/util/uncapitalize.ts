export const uncapitalize = (str: string) => {
  if (str.length === 0) {
    return str
  };

  return str[0]!.toLowerCase() + str.slice(1);
}
