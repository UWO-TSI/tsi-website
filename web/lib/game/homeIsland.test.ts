import { describe, expect, it } from "vitest";
import { createHomeIsland, homeBoatPrompt, HOME_PIER, HOME_SPAWN, HOUSE, HOME_DOCK, HOME_RADII } from "./homeIsland";
import { ASHORE, BOARDING, STEP_AT, dockToWorld } from "./wharf";
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
  it("has a pier at the dock (arrival-wharf §2): you walk from the sand out along it to the boat, and the sea beside it stays the sea", () => {
    const world = home.worldWith([]), tip = { x: 0, z: 0 }, step = { x: 0, z: 0 }, beside = { x: 0, z: 0 };
    dockToWorld(HOME_PIER, ASHORE.x, ASHORE.z, tip);
    // The pier's land end is the dock point.
    expect([+tip.x.toFixed(6), +tip.z.toFixed(6)]).toEqual([HOME_DOCK[0], HOME_DOCK[1]]);
    dockToWorld(HOME_PIER, STEP_AT.x, STEP_AT.z, step);
    expect(world.wet(step.x, step.z)).toBe(false);
    expect(home.fixedFree(step.x, step.z)).toBe(true);
    const s = walkTo(world, HOME_SPAWN[0], HOME_SPAWN[2], step.x, step.z);
    expect(Math.hypot(s.x - step.x, s.z - step.z)).toBeLessThan(0.2);
    dockToWorld(HOME_PIER, 2.4, -2.5, beside);
    expect(world.wet(beside.x, beside.z)).toBe(true);
    expect(home.placeable(Math.floor(step.x), Math.floor(step.z))).toBe(false);
  });
  it("offers the boat at the pier's tip, by the moored boat, not on the beach", () => {
    const tip = { x: 0, z: 0 };
    dockToWorld(HOME_PIER, BOARDING.x, BOARDING.z, tip);
    expect(homeBoatPrompt(tip.x, tip.z)).toBe(true);
    expect(homeBoatPrompt(HOME_SPAWN[0], HOME_SPAWN[2])).toBe(false);
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
