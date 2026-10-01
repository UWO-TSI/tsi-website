import { describe, expect, it } from "vitest";
import { ParticlePool } from "@/lib/game/fx/particles";
import { PACK, PACK_COLS } from "@/lib/game/fx/pack";
import { Surface } from "@/lib/game/grid";
import { LAND, dashBurst, footstep, groundUnder, landKind, landing, slideBurst, slidePop, slideTrail, takeoff } from "./juice";

const dry = () => false;
/** Sprite names written to the pool, sorted (what a move threw). */
function thrown(p: ParticlePool) {
  p.write(0, 8, -10, 0, -0.5, 0.85);
  const byRow = Object.fromEntries(Object.entries(PACK).map(([name, { row }]) => [row, name]));
  return Array.from({ length: p.count }, (_, o) => byRow[Math.floor(p.b[o * 4 + 3] / PACK_COLS)]).sort();
}

describe("the ground under the feet", () => {
  it("names every surface, wet sand by the waterline, snow over all but the boards", () => {
    expect(groundUnder(Surface.Grass, 0, dry, 0, 0)).toBe("grass");
    expect(groundUnder(Surface.Ramp, 0, dry, 0, 0)).toBe("grass");
    expect(groundUnder(Surface.Soil, 0, dry, 0, 0)).toBe("soil");
    expect(groundUnder(Surface.Stone, 0, dry, 0, 0)).toBe("stone");
    expect(groundUnder(Surface.Brick, 0, dry, 0, 0)).toBe("stone");
    expect(groundUnder(Surface.Wood, 0, dry, 0, 0)).toBe("wood");
    expect(groundUnder(Surface.River, 0, () => true, 0, 0)).toBe("water");
    expect(groundUnder(Surface.River, 0, dry, 0, 0)).toBe("wood"); // a deck over the water
    expect(groundUnder(Surface.Sand, 0, dry, 0, 0)).toBe("sand");
    // The sea a little over half a tile to the east: wet sand; two tiles away: dry.
    const sea = (x: number) => x > 0.6;
    expect(groundUnder(Surface.Sand, 0, sea, 0, 0)).toBe("wetSand");
    expect(groundUnder(Surface.Sand, 0, sea, -1.5, 0)).toBe("sand");
    expect(groundUnder(Surface.Grass, 0.8, dry, 0, 0)).toBe("snow");
    expect(groundUnder(Surface.Wood, 0.8, dry, 0, 0)).toBe("wood");
    expect(groundUnder(undefined, 0, dry, 0, 0)).toBe("soil");
  });
});

describe("what each move throws", () => {
  it("footsteps: flecks on grass, a sand kick, a snow puff, a puff on soil; nothing on boards or stone but the sound", () => {
    const step = (g: Parameters<typeof footstep>[1], rain = false) => { const p = new ParticlePool(64); const sound = footstep(p, g, 1, 0, 2, 0, 7, rain); return { sound, sprites: thrown(p) }; };
    expect(step("grass").sprites).toContain("grass");
    expect(step("sand").sprites).toEqual(["dust", "sand"]);
    expect(step("snow").sprites[0]).toBe("snow");
    expect(step("soil").sprites).toEqual(["dust"]);
    expect(step("wood")).toEqual({ sound: { name: "blip4", rate: 1, gain: 0.7 }, sprites: [] });
    expect(step("stone").sprites).toEqual([]);
    expect(step("stone").sound.name).toBe("blip3");
    // A rain day: a ripple and a drop with every step, but not on the boards.
    expect(step("stone", true).sprites).toEqual(["droplets", "ripple"]);
    expect(step("wood", true).sprites).toEqual([]);
    // Off in the lab's Juice panel: the sound stays.
    const p = new ParticlePool(8);
    expect(footstep(p, "grass", 0, 0, 0, 0, 7, false, 0).name).toBe("footstep");
    expect(p.alive).toBe(0);
  });

  it("landings by drop height: motes for a tap, a ring for a normal drop, a bigger ring and a plume for a heavy one", () => {
    expect([0.2, LAND.tap, 0.95, LAND.heavy, 3].map(landKind)).toEqual(["tap", "normal", "normal", "heavy", "heavy"]);
    const land = (drop: number) => { const p = new ParticlePool(128); landing(p, "soil", landKind(drop), 0, 0, 0, 0, 0); return thrown(p); };
    const tap = land(0.3), normal = land(0.95), heavy = land(2.5);
    expect(new Set(tap)).toEqual(new Set(["dust"]));
    expect(tap.length).toBeLessThanOrEqual(3);
    expect(normal.filter(s => s === "dustLow").length).toBeGreaterThanOrEqual(6);
    expect(heavy.filter(s => s === "dustLow").length).toBeGreaterThan(normal.filter(s => s === "dustLow").length);
    expect(heavy).toContain("dust");
    // Grass adds its flecks to the ring.
    const p = new ParticlePool(128);
    landing(p, "grass", "normal", 0, 0, 0, 0, 0);
    expect(thrown(p)).toContain("grass");
  });

  it("take-off kicks dust back from the feet, a ring of motes from a standing jump", () => {
    const p = new ParticlePool(64);
    takeoff(p, "soil", 0, 0, 0, 0, 9);
    p.update(0.1, 0, 0);
    p.write(0, 8, -10, 0, -0.5, 0.85);
    for (let o = 0; o < p.count; o++) expect(p.a[o * 4 + 2]).toBeLessThan(0); // behind a runner going +z
    const still = new ParticlePool(64);
    takeoff(still, "soil", 0, 0, 0, 0, 0);
    expect(thrown(still).every(s => s === "dust")).toBe(true);
  });

  it("the dash: a burst of dust on the ground, a puff of air and a swirl in the air", () => {
    const ground = new ParticlePool(64), air = new ParticlePool(64);
    dashBurst(ground, "grass", false, 0, 0, 0, 0, 0, 1);
    dashBurst(air, "grass", true, 0, 2, 0, 0, 0, 1);
    expect(thrown(ground)).toEqual(expect.arrayContaining(["dust", "dustLow", "grass"]));
    expect(thrown(air)).toContain("swirl");
    expect(thrown(air)).not.toContain("grass");
  });
});

describe("the slide's juice (specs/movement-slide.md)", () => {
  const beat = (g: Parameters<typeof slideTrail>[1], scuffIt = true, amount = 1) => { const p = new ParticlePool(64); slideTrail(p, g, 0, 0, 0, 0, 0.36, 0, 14, scuffIt, amount); return thrown(p); };
  it("trails dust off the heels with the ground's own spray and scuffs: flecks on grass, sand on sand; only faint dust on built ground", () => {
    expect(beat("grass")).toEqual(expect.arrayContaining(["dustLow", "grass", "scuff"]));
    expect(beat("sand")).toEqual(expect.arrayContaining(["dustLow", "sand", "scuff"]));
    expect(beat("snow")).toEqual(expect.arrayContaining(["dustLow", "snow"]));
    expect(beat("grass", false)).not.toContain("scuff");
    expect(beat("stone")).toEqual(["dustLow"]);
    expect(beat("water")).toEqual([]);
    expect(beat("grass", true, 0)).toEqual([]);
    // Seeded from the spot: the same slide throws the same trail on every client.
    expect(beat("grass")).toEqual(beat("grass"));
  });
  it("a dash- or land-slide sprays ahead; the slide-jump pops a ring of dust", () => {
    const p = new ParticlePool(64);
    slideBurst(p, "sand", 0, 0, 0, 0, 16);
    expect(thrown(p)).toEqual(expect.arrayContaining(["dust", "sand"]));
    const q = new ParticlePool(64);
    slidePop(q, "soil", 0, 0, 0, 0, 14);
    expect(new Set(thrown(q))).toEqual(new Set(["dustLow"]));
  });
});
