import { describe, expect, it } from "vitest";
import { createHomeIsland, HOME_SPAWN, HOUSE, HOME_DOCK, HOME_RADII } from "./homeIsland";
import { canPlace } from "@/lib/homes/layout";

describe("home island", () => {
  const home = createHomeIsland();
  it("is about a quarter of the village core", () => {
    const area = Math.PI * HOME_RADII.x * HOME_RADII.z, village = Math.PI * 24 * 20;
    expect(area / village).toBeGreaterThan(0.2);
    expect(area / village).toBeLessThan(0.3);
  });
  it("walks from the dock to the front door without entering the house", () => {
    const move = home.moveWith([]);
    expect(home.fixedFree(HOME_SPAWN[0], HOME_SPAWN[2])).toBe(true);
    const [, z] = move(0, HOME_SPAWN[2], 0, 10);
    expect(z).toBeGreaterThan(HOUSE.door[1] - 0.3);
    expect(z).toBeLessThan(HOUSE.z - HOUSE.halfD);
  });
  it("places outdoor items with the room code and blocks walking through them", () => {
    const bench = { uid: "b", piece: "bench-wood", cell: [-4, -3] as [number, number], rot: 0 as const };
    expect(canPlace(bench, { items: [], inside: home.placeable })).toBe(true);
    expect(canPlace({ ...bench, cell: [0, 3] }, { items: [], inside: home.placeable })).toBe(false); // house
    expect(canPlace({ ...bench, cell: [20, 0] }, { items: [], inside: home.placeable })).toBe(false); // sea
    expect(canPlace({ ...bench, cell: [HOME_DOCK[0], HOME_DOCK[1]] }, { items: [], inside: home.placeable })).toBe(false);
    const [x] = home.moveWith([bench])(-6, -2.5, -1, -2.5);
    expect(x).toBeLessThan(-4.1);
  });
});
