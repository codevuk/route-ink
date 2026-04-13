export const compileTemplate = (template: string, data: Record<string, string | undefined>) => {
  let compiled = template;

  for (const key in data) {
    const value = data[key];
    const placeholder = `@${key}@`;

    if (value === undefined) {
      compiled = compiled.replaceAll(placeholder, "");
      continue;
    }

    compiled = compiled.replaceAll(placeholder, value);
  }

  return compiled;
}