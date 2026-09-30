import { describe, expect, it } from "vitest";
import { createHomeIsland, HOME_SPAWN, HOUSE, HOME_DOCK, HOME_RADII } from "./homeIsland";
import { canPlace } from "@/lib/homes/layout";
import { NO_INPUT, STEP, createMoveState, stepMove, walkTo } from "./movement/sim";

describe("home island", () => {
  const home = createHomeIsland();
  it("is about a quarter of the village core", () => {
    const area = Math.PI * HOME_RADII.x * HOME_RADII.z, village = Math.PI * 24 * 20;
    expect(area / village).toBeGreaterThan(0.2);
    expect(area / village).toBeLessThan(0.3);
  });
  it("walks from the dock to the front door without entering the house (the movement kit)", () => {
    expect(home.fixedFree(HOME_SPAWN[0], HOME_SPAWN[2])).toBe(true);
    const { z } = walkTo(home.worldWith([]), 0, HOME_SPAWN[2], 0, 10);
    expect(z).toBeGreaterThan(HOUSE.door[1] - 0.3);
    expect(z).toBeLessThan(HOUSE.z - HOUSE.halfD);
  });
  it("splashes a jump into the sea and puts you back on the shore", () => {
    const world = home.worldWith([]);
    let s = createMoveState(6, -8, world, Math.PI);
    const seen: string[] = [];
    for (let i = 0; i < 3 / STEP; i++) {
      s = stepMove(s, { ...NO_INPUT, z: -1, jump: i < 30, jumpPressed: i === 12 }, STEP, world);
      seen.push(...s.events.map(e => e.kind));
    }
    expect(seen).toContain("splash");
    expect(seen).toContain("respawn");
    expect(world.wet(s.x, s.z)).toBe(false);
    expect(home.fixedFree(s.x, s.z)).toBe(true);
  });
  it("places outdoor items with the room code and blocks walking through them", () => {
    const bench = { uid: "b", piece: "bench-wood", cell: [-4, -3] as [number, number], rot: 0 as const };
    expect(canPlace(bench, { items: [], inside: home.placeable })).toBe(true);
    expect(canPlace({ ...bench, cell: [0, 3] }, { items: [], inside: home.placeable })).toBe(false); // house
    expect(canPlace({ ...bench, cell: [20, 0] }, { items: [], inside: home.placeable })).toBe(false); // sea
    expect(canPlace({ ...bench, cell: [HOME_DOCK[0], HOME_DOCK[1]] }, { items: [], inside: home.placeable })).toBe(false);
    expect(walkTo(home.worldWith([bench]), -6, -2.5, -1, -2.5).x).toBeLessThan(-4.1);
  });
});
