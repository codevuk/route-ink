const splitWords = (input: string): string[] => {
  const matches = input.match(/[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|[0-9]+/g);
  return matches ?? [];
};

const titleCase = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

export const toCamelCase = (input: string): string => {
  const words = splitWords(input);

  if (words.length === 0) {
    return input;
  }

  return words[0]!.toLowerCase() + words.slice(1).map(titleCase).join("");
};

export const toPascalCase = (input: string): string => input;

export const toUpperSnakeCase = (input: string): string =>
  splitWords(input).map((w) => w.toUpperCase()).join("_");

export const toKebabCase = (input: string): string =>
  splitWords(input).map((w) => w.toLowerCase()).join("-");
