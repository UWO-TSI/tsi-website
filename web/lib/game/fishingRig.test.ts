import { describe, expect, it } from "vitest";
import { FLOAT, bobberOnWater, castBeat, flightAt, flightTime, newCast, releaseAfter, throwCast, type BobberPose } from "./fishingRig";
import { CLIP_BY_NAME } from "./character/look";
import { createCenteredMap, isGroundAtWorld, setCell, Surface } from "./grid";

// A meadow with a river two cells wide along z = 0..1 (world), the water at height -0.1.
const map = createCenteredMap(24, 24);
for (let z = 0; z < 24; z++) for (let x = 0; x < 24; x++) setCell(map, x, z, 0, z === 12 || z === 13 ? Surface.River : Surface.Grass);
const water = { isWater: (x: number, z: number) => !isGroundAtWorld(map, x, z), height: () => -0.1 };
const pose = (): BobberPose => ({ x: 0, y: 0, z: 0, under: 0 });

describe("an avatar's cast as its own state", () => {
  it("lands the throw on the scene's water, along the throw, and whips faster the harder it is cast", () => {
    const weak = throwCast(newCast(true, 0, -1.6, 0, 0.4, 0), 0, 100, water);
    const hard = throwCast(newCast(true, 0, -1.6, 0, 0.4, 0), 1, 100, water);
    for (const f of [weak, hard]) {
      expect(isGroundAtWorld(map, f.landX, f.landZ)).toBe(false);
      expect(f.waterY).toBe(-0.1);
      expect([f.dirX, f.dirZ]).toEqual([0, 1]);
      expect(f.phase).toBe("swing");
      expect(f.since).toBe(100);
    }
    expect(hard.rate).toBeGreaterThan(weak.rate);
    expect(releaseAfter(hard.rate)).toBeLessThan(releaseAfter(weak.rate));
    // The bobber leaves the tip on the swing's release key.
    const swing = CLIP_BY_NAME.get("CastSwing")!;
    expect(releaseAfter(1)).toBeCloseTo(swing.release! * swing.length, 5);
  });
  it("is the same cast on every client: the seed comes from where it lands", () => {
    const a = throwCast(newCast(true, 0, -1.6, 0, 0.4, 0), 0.5, 0, water);
    const b = throwCast(newCast(false, 0, -1.6, 0, 0.4, 999), 0.5, 4000, water);
    expect(b.seed).toBe(a.seed);
    expect([b.landX, b.landZ]).toEqual([a.landX, a.landZ]);
  });
});

describe("where the bobber is", () => {
  const f = throwCast(newCast(true, 0, -1.6, 0, 0.4, 0), 0.6, 0, water);
  it("flies from the release point to its landing on the water, arcing above both", () => {
    const start = flightAt(f, 0.3, 1.4, -1.2, 0, pose()), end = flightAt(f, 0.3, 1.4, -1.2, 1, pose());
    expect([start.x, start.y, start.z]).toEqual([0.3, 1.4, -1.2]);
    expect(end.x).toBeCloseTo(f.landX, 6);
    expect(end.z).toBeCloseTo(f.landZ, 6);
    expect(end.y).toBeCloseTo(f.waterY + FLOAT, 6);
    const mid = flightAt(f, 0.3, 1.4, -1.2, 0.5, pose());
    expect(mid.y).toBeGreaterThan(1.4);
    expect(flightTime(4)).toBeGreaterThan(flightTime(1));
  });
  it("floats at the surface, a nibble dips it, the bite pulls it under", () => {
    const float = castBeat({ ...f }, "float", 0);
    for (let t = 0; t < 3; t += 0.1) {
      const p = bobberOnWater(float, t, 1e9, pose());
      expect(Math.abs(p.y - (f.waterY + FLOAT))).toBeLessThan(0.02);
      expect(p.under).toBe(0);
    }
    float.nibbleAt = 1000;
    expect(bobberOnWater(float, 1, 1000 + 210, pose()).y).toBeLessThan(f.waterY + FLOAT - 0.03);
    expect(bobberOnWater(float, 1, 1000 + 900, pose()).y).toBeCloseTo(bobberOnWater(float, 1, 1e9, pose()).y, 6);
    const bite = castBeat({ ...f }, "bite", 0);
    for (let t = 0; t < 2; t += 0.05) expect(bobberOnWater(bite, t, 0, pose()).y).toBeLessThan(f.waterY);
  });
  it("is dragged across the throw by the fish and in toward the bank as it is reeled", () => {
    const reel = castBeat({ ...f }, "reel", 0);
    const mid = bobberOnWater({ ...reel, pull: 0 }, 0.5, 0, pose());
    const left = bobberOnWater({ ...reel, pull: -1 }, 0.5, 0, pose()), right = bobberOnWater({ ...reel, pull: 1 }, 0.5, 0, pose());
    // The throw runs along +z: pulling moves it along x, either way.
    expect(right.x - mid.x).toBeCloseTo(-(left.x - mid.x), 6);
    expect(Math.abs(right.x - mid.x)).toBeGreaterThan(0.5);
    const home = bobberOnWater({ ...reel, reeled: 1 }, 0.5, 0, pose());
    expect(Math.hypot(home.x - f.spotX, home.z - f.spotZ)).toBeLessThan(Math.hypot(mid.x - f.spotX, mid.z - f.spotZ));
  });
  it("gives the same pose for the same cast and moment", () => {
    const a = castBeat({ ...f }, "bite", 0), b = castBeat({ ...f }, "bite", 5000);
    expect(bobberOnWater(a, 0.73, 0, pose())).toEqual(bobberOnWater(b, 0.73, 0, pose()));
  });
});
