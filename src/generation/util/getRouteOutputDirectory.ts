const normalizeRelativePath = (relativePath: string) => relativePath.replace(/\\/g, "/");

export const getRouteOutputDirectory = (relativePath: string): string => {
  const normalizedPath = normalizeRelativePath(relativePath);
  const pathWithoutExtension = normalizedPath.replace(/\.route\.ts$/, "");

  if (pathWithoutExtension === "index") {
    return "";
  }

  return pathWithoutExtension.replace(/\/index$/, "");
};

export const getRouteNestingLevel = (relativePath: string): number => {
  const routeOutputDirectory = getRouteOutputDirectory(relativePath);

  return routeOutputDirectory === ""
    ? 1
    : routeOutputDirectory.split("/").length + 1;
};