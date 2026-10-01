import { describe, expect, it } from "vitest";
import { CAFE_DOOR, CAFE_EXIT_RANGE, CAFE_OWNER, CAFE_SPAWN, OWNER_STATIONS, ownerAt } from "./cafe";
import { parseLook } from "@/lib/game/character/look";
import { studySolid } from "@/lib/study/seats";

describe("café prompts (cafe-polish §2)", () => {
  it("arrives a step inside, clear of furniture and outside the exit prompt", () => {
    expect(Math.hypot(CAFE_SPAWN[0] - CAFE_DOOR[0], CAFE_SPAWN[1] - CAFE_DOOR[1])).toBeGreaterThan(CAFE_EXIT_RANGE);
    expect(studySolid("cafe", ...CAFE_SPAWN, 0.4)).toBe(false);
  });
});

describe("café owner routine (cafe-polish §6)", () => {
  it("loops through her stations behind the counter, walking between them, never through the room", () => {
    const xs = OWNER_STATIONS.map(s => s.at[0]), zs = OWNER_STATIONS.map(s => s.at[1]);
    for (let t = 0; t < 120; t += 0.25) {
      const o = ownerAt(t);
      expect(o.x).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-9);
      expect(o.x).toBeLessThanOrEqual(Math.max(...xs) + 1e-9);
      expect(o.z).toBeGreaterThanOrEqual(Math.min(...zs) - 1e-9);
      expect(o.z).toBeLessThanOrEqual(Math.max(...zs) + 1e-9);
    }
    expect(ownerAt(0)).toMatchObject({ clip: "Idle", moving: false });
    expect(ownerAt(7.5)).toMatchObject({ clip: "Walk", moving: true });
    expect(ownerAt(12345.6)).toEqual(ownerAt(12345.6)); // the shared clock: everyone sees her in the same place
  });
  it("has a fixed, wearable look and two or three lines", () => {
    expect(parseLook(CAFE_OWNER.look)).toEqual(CAFE_OWNER.look);
    expect(CAFE_OWNER.lines.length).toBeGreaterThanOrEqual(2);
    expect(CAFE_OWNER.lines.length).toBeLessThanOrEqual(3);
    for (const l of CAFE_OWNER.lines) expect(l).not.toMatch(/\$|CAD|price/i);
  });
});
