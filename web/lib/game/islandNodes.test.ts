import { describe, expect, it } from "vitest";
import { homeNodes, villageNodes } from "./islandNodes";
import { createDefaultIsland } from "./defaultIsland";
import { createHomeIsland } from "./homeIsland";
import { isGroundAtWorld } from "./grid";

describe("island nodes", () => {
  it("puts every village node on dry, walkable-adjacent land with unique ids", () => {
    const island = createDefaultIsland();
    const { forage, bugs } = villageNodes();
    const all = [...forage, ...bugs];
    expect(new Set(all.map(n => n.id)).size).toBe(all.length);
    for (const n of all) expect(isGroundAtWorld(island.map, n.x, n.z), n.id).toBe(true);
    expect(forage.some(n => n.categories.includes("fruit"))).toBe(true);
    expect(forage.some(n => n.biomes.includes("beach"))).toBe(true);
    expect(forage.some(n => n.categories.includes("mineral"))).toBe(true);
    expect(bugs.length).toBeGreaterThanOrEqual(12);
  });
  it("gives the home island its own fruit, shells and bugs", () => {
    const home = createHomeIsland();
    const { forage, bugs } = homeNodes();
    for (const n of [...forage, ...bugs]) expect(isGroundAtWorld(home.map, n.x, n.z), n.id).toBe(true);
    expect(forage.length).toBeGreaterThan(4);
  });
});
