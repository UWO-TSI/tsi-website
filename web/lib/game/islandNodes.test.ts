import { describe, expect, it } from "vitest";
import { homeNodes, villageBottleSpot, villageNodes } from "./islandNodes";
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
    expect(forage.filter(n => n.drop?.key === "wood_branch").length).toBeGreaterThan(4);
  });
  it("washes the message bottle up on the beach, one spot per day", () => {
    const island = createDefaultIsland();
    const days = ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"].map(villageBottleSpot);
    for (const [x, z] of days) expect(isGroundAtWorld(island.map, x, z)).toBe(true);
    expect(new Set(days.map(String)).size).toBeGreaterThan(1);
    expect(villageBottleSpot("2026-09-24")).toEqual(days[0]);
  });
  it("gives the home island its own fruit, shells and bugs", () => {
    const home = createHomeIsland();
    const { forage, bugs } = homeNodes();
    for (const n of [...forage, ...bugs]) expect(isGroundAtWorld(home.map, n.x, n.z), n.id).toBe(true);
    expect(forage.length).toBeGreaterThan(4);
  });
});
