import type { CubeFile, Violation } from "../types.js";
import { refreshCubeFile } from "../yaml/cube-files.js";

export const applyRelationshipMetadataRule = (
  cubeFiles: CubeFile[],
): Violation[] => {
  const violations: Violation[] = [];

  for (const cubeFile of cubeFiles) {
    for (const cube of cubeFile.cubes) {
      const pendingAdds: Array<{ cube: string; type: string }> = [];
      let hasChanges = false;
      const relationships = cube.relationships.map((relationship) => ({
        ...relationship,
      }));

      for (const join of cube.joins) {
        if (!join.relationship) {
          continue;
        }

        const existing = relationships.find((relationship) => relationship.cube === join.name);

        if (existing?.type === join.relationship) {
          continue;
        }

        violations.push({
          rule: "relationships",
          message: `${cube.name}.joins.${join.name} — expected meta.relationships entry { cube: ${join.name}, type: ${join.relationship} }`,
        });

        if (existing) {
          cubeFile.doc.setIn([...existing.path, "cube"], join.name);
          cubeFile.doc.setIn([...existing.path, "type"], join.relationship);
          existing.cube = join.name;
          existing.type = join.relationship;
          hasChanges = true;
        }
        else {
          pendingAdds.push({ cube: join.name, type: join.relationship });
          relationships.push({
            cube: join.name,
            type: join.relationship,
            path: [],
          });
        }
      }

      if (pendingAdds.length > 0) {
        if (cube.relationships.length === 0) {
          cubeFile.doc.setIn([...cube.path, "meta", "relationships"], pendingAdds);
        }
        else {
          for (const relationship of pendingAdds) {
            cubeFile.doc.addIn([...cube.path, "meta", "relationships"], relationship);
          }
        }
        hasChanges = true;
      }

      if (hasChanges) {
        cubeFile.changed = true;
        refreshCubeFile(cubeFile);
      }
    }
  }

  return violations;
};
