import type { CubeAnnotation } from "./types.js";

export const parseCubeAnnotation = (documentation: string | undefined): CubeAnnotation => {
  const annotation: CubeAnnotation = {};
  const descriptions: string[] = [];
  const aiContexts: string[] = [];

  for (const line of documentation?.split("\n") ?? []) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@cube.name ")) {
      annotation.name = trimmed.slice("@cube.name ".length).trim();
    }
    else if (trimmed.startsWith("@cube.description ")) {
      descriptions.push(trimmed.slice("@cube.description ".length).trim());
    }
    else if (trimmed.startsWith("@cube.ai_context ")) {
      aiContexts.push(trimmed.slice("@cube.ai_context ".length).trim());
    }
    else if (trimmed === "@cube.public false") {
      annotation.public = false;
    }
    else if (trimmed === "@cube.public true") {
      annotation.public = true;
    }
    else if (trimmed === "@cube.visibility pii_export") {
      annotation.public = "{{ COMPILE_CONTEXT.securityContext.role == 'pii_export' }}";
    }
  }

  return {
    ...annotation,
    ...(descriptions.length > 0 ? { description: descriptions.join(" ") } : {}),
    ...(aiContexts.length > 0 ? { aiContext: aiContexts.join(" ") } : {}),
  };
};

export const getDocumentationDescription = (
  documentation: string | undefined,
  annotation: CubeAnnotation,
): string | undefined => {
  if (annotation.description) {
    return annotation.description;
  }

  const description = documentation
    ?.split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("@cube."))
    .join(" ");

  return description || undefined;
};
