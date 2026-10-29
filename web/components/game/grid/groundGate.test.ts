/**
 * The smooth world's gate (specs/world-editor.md v0 step 3): only a world loaded from the editor's files draws and walks
 * the heightfield. Every other world (the applicant island, the ruins, the home island, the movement lab, the v2 cell
 * draft, the server's cell view) takes the cell path. The member island and the title draw the new world.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
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
      "components/game/movement/MoveLab.tsx"]) {
      const tags = gridWorlds(path);
      expect(tags.length, path).toBeGreaterThan(0);
      for (const tag of tags) expect(tag, path).not.toMatch(/\bterrain=/);
    }
    // The member island and the title pass the world's own (absent for every village built from a cell document).
    for (const path of ["components/game/DefaultIslandWorld.tsx", "components/title/TitleScene.tsx"])
      for (const tag of gridWorlds(path)) expect(tag, path).toMatch(/\bterrain=\{v\.terrain\}/);
  });

  it("builds every cell village without a heightfield, so it walks its levels as before", () => {
    const cellDocs: [string, VillageDoc][] = [
      ["the terrain fixture", terrainFixtureDoc()],
    ];
    for (const [name, doc] of cellDocs) {
      const v = buildVillage(doc);
      expect(groundKind(v), name).toBe("cells");
      expect(villageIsland(v).climb, name).toBeUndefined();
    }
    expect(groundKind(village())).toBe("cells"); // the new world's cell view, until the full world loads
  });

  it("walks the smooth world by its slope", () => {
    const w = loadWorldFromDisk(join(web, "data/world")), v = villageOfWorld(w);
    expect(groundKind(v)).toBe("heightfield");
    expect(typeof villageIsland(v).climb).toBe("function");
  });
});

/** The member island's world load (lib/game/world/load.ts loadGameWorld), with the images read from disk. */
describe("the world load", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const fresh = async () => {
    vi.stubGlobal("fetch", async (url: string) => new Response(readFileSync(fileURLToPath(url))));
    vi.resetModules();
    return { load: await import("@/lib/game/world/load"), map: await import("@/lib/game/villageMap"), gate: await import("@/lib/game/world/village") };
  };

  it("starts on the new world's cell view, the server's island", async () => {
    const { map, gate } = await fresh();
    expect(gate.groundKind(map.village())).toBe("cells");
    expect(map.objectById("landmark", "wharf", map.village())).not.toBeNull();
  });

  it("loads the new world into the island before it mounts, once", async () => {
    const { load, map, gate } = await fresh();
    await load.loadGameWorld();
    const v = map.village();
    expect(gate.groundKind(v)).toBe("heightfield");
    expect(v.map.width).toBe(loadWorldFromDisk(join(web, "data/world")).terrain.width);
    expect(map.objectById("landmark", "wharf", v)).not.toBeNull();
    expect(load.loadGameWorld()).not.toBeNull(); // the same load, never a second one
  });

  it("leaves a lab's island alone (the painter's draft, a fixture)", async () => {
    const { load, map, gate } = await fresh();
    map.setVillageDoc(terrainFixtureDoc());
    expect(load.loadGameWorld()).toBeNull();
    expect(gate.groundKind(map.village())).toBe("cells");
  });
});
