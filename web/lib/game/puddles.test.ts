import { afterEach, describe, expect, it } from "vitest";
import { ParticlePool } from "@/lib/game/fx/particles";
import { PACK, PACK_COLS } from "@/lib/game/fx/pack";
import { footstep } from "./movement/juice";
import { puddleAt, setPuddles } from "./puddles";

function thrown(p: ParticlePool) {
  p.write(0, 8, -10, 0, -0.5, 0.85);
  const byRow = Object.fromEntries(Object.entries(PACK).map(([name, { row }]) => [row, name]));
  return Array.from({ length: p.count }, (_, o) => byRow[Math.floor(p.b[o * 4 + 3] / PACK_COLS)]);
}

describe("stepping in a puddle", () => {
  afterEach(() => setPuddles([]));
  it("knows the rain's puddles by their own outlines", () => {
    setPuddles([{ x: 2, z: 3, rx: 0.6, rz: 0.4 }]);
    expect(puddleAt(2, 3)).toBe(true);
    expect(puddleAt(2.5, 3)).toBe(true);
    expect(puddleAt(2, 3.5)).toBe(false);
    setPuddles([]);
    expect(puddleAt(2, 3)).toBe(false);
  });

  it("splashes in the rain: a crown of droplets, a wide ring across it and the splash's own sound", () => {
    setPuddles([{ x: 0, z: 0, rx: 0.8, rz: 0.5 }]);
    const p = new ParticlePool(64), sound = footstep(p, "grass", 0, 0, 0, 0, 7, true);
    const dry = new ParticlePool(64), drySound = footstep(dry, "grass", 3, 0, 3, 0, 7, true);
    expect(thrown(p).filter(s => s === "droplets").length).toBeGreaterThan(thrown(dry).filter(s => s === "droplets").length + 2);
    // Its ring runs out wider than a rain step's dab on the grass, and no grass flecks fly out of the water.
    const widest = (pool: ParticlePool) => Math.max(0, ...thrown(pool).map((s, o) => (s === "ripple" ? pool.b[o * 4] : 0)));
    expect(widest(p)).toBeGreaterThan(widest(dry) * 1.3);
    expect(thrown(p)).not.toContain("grass");
    expect(sound).not.toEqual(drySound);
    expect(sound.name).not.toMatch(/^blip|^enter$|^exit$/);
  });

  it("doesn't splash where the puddles are dry (no rain, none drawn)", () => {
    setPuddles([{ x: 0, z: 0, rx: 0.8, rz: 0.5 }]);
    const p = new ParticlePool(64);
    footstep(p, "grass", 0, 0, 0, 0, 7, false);
    expect(thrown(p)).not.toContain("droplets");
  });
});
