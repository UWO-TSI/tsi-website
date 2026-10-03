import { describe, expect, it } from "vitest";
import { BANK_CLEAR, castLanding, thrash, throwReach } from "./fishingCast";
import { fishingSpot, villageWater } from "./fishingSpots";
import { islandOf, villageIsland } from "./defaultIsland";
import { createCenteredMap, isGroundAtWorld, setCell, Surface, type IslandMap } from "./grid";
import { buildVillage, village, type VillageDoc } from "./villageMap";
import frozen from "./fixtures/village-2026-09-28.json";

const POWERS = [0, 0.35, 0.7, 1];
const onWater = (map: IslandMap) => (x: number, z: number) => !isGroundAtWorld(map, x, z);

/** Every land point within `r` of the landing: none may be closer than the bank clearance (less a step's slack). */
function clearOfBank(map: IslandMap, x: number, z: number, r: number): boolean {
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2;
    if (isGroundAtWorld(map, x + Math.sin(t) * r, z + Math.cos(t) * r)) return false;
  }
  return true;
}

describe("a cast lands on water from every shore angle", () => {
  // A round pond (radius 5) in the middle of a 30×30 meadow, centred on the world origin.
  const pond = createCenteredMap(30, 30);
  for (let z = 0; z < 30; z++) for (let x = 0; x < 30; x++) setCell(pond, x, z, 0, Math.hypot(x - 15, z - 15) < 5.2 ? Surface.River : Surface.Grass);
  /** Where to stand on the pond's bank at angle t: just past the first land out from the middle. */
  const bank = (t: number): [number, number] => {
    let r = 2;
    while (!isGroundAtWorld(pond, Math.sin(t) * r, Math.cos(t) * r)) r += 0.05;
    return [Math.sin(t) * (r + 0.3), Math.cos(t) * (r + 0.3)];
  };
  it("round a pond, at every power", () => {
    for (let a = 0; a < 48; a++) {
      const [x, z] = bank((a / 48) * Math.PI * 2);
      const spot = fishingSpot(pond, () => "pond", x, z);
      expect(spot, `angle ${a}`).not.toBeNull();
      for (const power of POWERS) {
        const land = castLanding(onWater(pond), x, z, spot!.target[0], spot!.target[1], power);
        expect(isGroundAtWorld(pond, land.x, land.z), `angle ${a} power ${power}`).toBe(false);
      }
    }
  });
  // A river two cells wide across the meadow: a full cast from one bank must not reach the other.
  const river = createCenteredMap(24, 24);
  for (let z = 0; z < 24; z++) for (let x = 0; x < 24; x++) setCell(river, x, z, 0, z === 11 || z === 12 ? Surface.River : Surface.Grass);
  it("across a narrow river, from both banks and at a slant", () => {
    for (const side of [-1, 1]) for (let k = -6; k <= 6; k++) {
      const x = k * 0.7, z = side * 1.6;
      const spot = fishingSpot(river, () => "river", x, z);
      expect(spot).not.toBeNull();
      for (const power of POWERS) {
        const land = castLanding(onWater(river), x, z, spot!.target[0], spot!.target[1], power);
        expect(isGroundAtWorld(river, land.x, land.z), `${x},${z} power ${power}`).toBe(false);
      }
    }
  });
  it("keeps clear of the far bank when there is room, and carries farther with power", () => {
    const [x, z] = bank(Math.PI);
    const spot = fishingSpot(pond, () => "pond", x, z)!;
    const weak = castLanding(onWater(pond), x, z, spot.target[0], spot.target[1], 0);
    const strong = castLanding(onWater(pond), x, z, spot.target[0], spot.target[1], 1);
    expect(Math.hypot(strong.x - x, strong.z - z)).toBeGreaterThan(Math.hypot(weak.x - x, weak.z - z));
    // The pond is ten across: a full throw carries its whole reach past the spot, and still keeps clear of the bank.
    expect(Math.hypot(strong.x - spot.target[0], strong.z - spot.target[1])).toBeCloseTo(throwReach(1), 1);
    expect(clearOfBank(pond, strong.x, strong.z, BANK_CLEAR - 0.11)).toBe(true);
  });
});

describe("a cast lands on water on the village map", () => {
  for (const [name, island, classify] of [
    ["frozen 2026-09-28 village", islandOf(buildVillage(frozen as VillageDoc)), villageWater(buildVillage(frozen as VillageDoc)).classify],
    ["live village", villageIsland(), villageWater().classify],
  ] as const) {
    it(`from every shore spot, at every power (${name})`, () => {
      const b = name === "live village" ? village().bounds : buildVillage(frozen as VillageDoc).bounds;
      let casts = 0;
      for (let x = b.minX; x <= b.maxX; x += 0.5) for (let z = b.minZ; z <= b.maxZ; z += 0.5) {
        if (!island.standable(x, z)) continue;
        const spot = fishingSpot(island.map, classify, x, z);
        if (!spot) continue;
        for (const power of POWERS) {
          const land = castLanding(onWater(island.map), x, z, spot.target[0], spot.target[1], power);
          casts++;
          expect(isGroundAtWorld(island.map, land.x, land.z), `${x},${z} power ${power}`).toBe(false);
        }
      }
      expect(casts).toBeGreaterThan(1000);
    });
  }
});

describe("castLanding", () => {
  it("throws along the bank-to-spot line, and straight ahead when standing on the spot", () => {
    const open = () => true;
    const a = castLanding(open, 0, 0, 3, 4, 0);
    expect(a.x / a.z).toBeCloseTo(3 / 4, 5);
    expect(Math.hypot(a.x - 3, a.z - 4)).toBeCloseTo(throwReach(0), 5);
    const b = castLanding(open, 1, 1, 1, 1, 1);
    expect([b.x, b.z]).toEqual([1, 1 + throwReach(1)]);
  });
  it("writes into the object it is given (no allocation on the frame path)", () => {
    const out = { x: 0, z: 0 };
    expect(castLanding(() => true, 0, 0, 0, 1, 0.5, out)).toBe(out);
  });
});

describe("the bite's thrash", () => {
  const at = (t: number, seed: number) => { const o = { x: 0, y: 0, z: 0 }; thrash(t, seed, o); return o; };
  it("is the same for the same cast and moment (every client agrees)", () => {
    for (const t of [0, 0.13, 0.5, 1.7, 4.2]) expect(at(t, 12345)).toEqual(at(t, 12345));
  });
  it("differs between casts", () => {
    const a = at(0.6, 1), b = at(0.6, 2);
    expect(Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.y - b.y)).toBeGreaterThan(1e-4);
  });
  it("moves smoothly: the step between frames shrinks with the frame time, unlike per-frame random jitter", () => {
    const worst = (dt: number) => {
      let w = 0;
      for (let t = 0; t < 3; t += dt) {
        const a = at(t, 777), b = at(t + dt, 777);
        w = Math.max(w, Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y));
      }
      return w;
    };
    // Random jitter of ±0.03 a frame jumps up to 8 cm at any frame rate; a continuous wander moves less as frames get shorter.
    expect(worst(1 / 60)).toBeLessThan(0.03);
    expect(worst(1 / 600)).toBeLessThan(worst(1 / 60) / 5);
  });
  it("stays within its reach and keeps the bobber under the surface", () => {
    for (let t = 0; t < 5; t += 0.01) {
      const o = at(t, 4242);
      expect(Math.hypot(o.x, o.z)).toBeLessThanOrEqual(0.06);
      expect(o.y).toBeLessThan(0);
    }
  });
  it("writes into the object it is given", () => {
    const o = { x: 0, y: 0, z: 0 };
    expect(thrash(1, 2, o)).toBe(o);
  });
});
