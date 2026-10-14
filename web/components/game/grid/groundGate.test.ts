/**
 * The smooth world's gate (specs/world-editor.md v0 step 3): only a world loaded from the editor's files draws and walks
 * the heightfield. Every other world (the village, the applicant island, the ruins, the home island, the title, the
 * movement lab, the v2 cell draft) takes the cell path, exactly as on main.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { worldGround } from "./GridWorld";
import { buildVillage, village, type VillageDoc } from "@/lib/game/villageMap";
import { villageIsland } from "@/lib/game/defaultIsland";
import { terrainFixtureDoc } from "@/lib/game/fixtures/terrainFixture";
import { groundKind, villageOfWorld } from "@/lib/game/world/village";
import { loadWorldFromDisk } from "@/lib/game/world/disk";

const web = fileURLToPath(new URL("../../../", import.meta.url));
const gridWorlds = (path: string) => [...readFileSync(join(web, path), "utf8").matchAll(/<GridWorld\b[^>]*\/>/g)].map(m => m[0]);

describe("the ground gate", () => {
  it("draws the heightfield only for a world that has one", () => {
    expect(worldGround({})).toBe("cells");
    expect(worldGround({ terrain: undefined })).toBe("cells");
    expect(worldGround({ terrain: loadWorldFromDisk(join(web, "data/world")).terrain })).toBe("heightfield");
  });

  it("keeps every other world's scene on the cells: no terrain passed", () => {
    for (const path of ["components/recruit/ApplicantWorld.tsx", "components/game/combat/RuinsScene.tsx", "components/game/home/HomeIslandScene.tsx",
      "components/title/TitleScene.tsx", "components/game/movement/MoveLab.tsx"]) {
      const tags = gridWorlds(path);
      expect(tags.length, path).toBeGreaterThan(0);
      for (const tag of tags) expect(tag, path).not.toMatch(/\bterrain=/);
    }
    // The village scene passes the village's own (absent for every village built from a cell document).
    for (const tag of gridWorlds("components/game/DefaultIslandWorld.tsx")) expect(tag).toMatch(/\bterrain=\{v\.terrain\}/);
  });

  it("builds every cell village without a heightfield, so it walks its levels as before", () => {
    const cellDocs: [string, VillageDoc][] = [
      ["village-map.json", JSON.parse(readFileSync(join(web, "data/village-map.json"), "utf8"))],
      ["world-map.json (the v2 cell draft)", JSON.parse(readFileSync(join(web, "data/world-map.json"), "utf8"))],
      ["the terrain fixture", terrainFixtureDoc()],
    ];
    for (const [name, doc] of cellDocs) {
      const v = buildVillage(doc);
      expect(groundKind(v), name).toBe("cells");
      expect(villageIsland(v).climb, name).toBeUndefined();
    }
    expect(groundKind(village())).toBe("cells");
  });

  it("walks the smooth world by its slope", () => {
    const w = loadWorldFromDisk(join(web, "data/world")), v = villageOfWorld(w);
    expect(groundKind(v)).toBe("heightfield");
    expect(typeof villageIsland(v).climb).toBe("function");
  });
});
