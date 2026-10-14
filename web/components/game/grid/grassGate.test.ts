import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { grassLayer } from "./GridWorld";

/** Every `<GridWorld …/>` element in a source file, as written. */
const gridWorlds = (path: string) => {
  const src = readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), "utf8");
  return [...src.matchAll(/<GridWorld\b[^>]*\/>/g)].map(m => m[0]);
};

describe("the grass gate (v1 land): the blade field only where the world names its obstacles", () => {
  it("draws the field with an obstacle list and the old tufts without one", () => {
    expect(grassLayer(() => true)).toBe("field");
    expect(grassLayer(undefined)).toBe("tufts");
  });

  it("keeps the applicant island (live for recruits), the ruins and the home island on the old tufts", () => {
    for (const path of ["components/recruit/ApplicantWorld.tsx", "components/game/combat/RuinsScene.tsx", "components/game/home/HomeIslandScene.tsx"]) {
      const tags = gridWorlds(path);
      expect(tags.length, path).toBeGreaterThan(0);
      for (const tag of tags) expect(tag, path).not.toMatch(/\bclear=/);
    }
  });

  it("gives the village (and the v2 world it walks) and the title the field", () => {
    for (const path of ["components/game/DefaultIslandWorld.tsx", "components/title/TitleScene.tsx"]) {
      const tags = gridWorlds(path);
      expect(tags.length, path).toBeGreaterThan(0);
      for (const tag of tags) expect(tag, path).toMatch(/\bclear=\{/);
    }
  });
});
