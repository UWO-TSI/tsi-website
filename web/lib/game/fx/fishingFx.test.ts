import { describe, expect, it } from "vitest";
import { ParticlePool } from "./particles";
import { PACK, PACK_COLS } from "./pack";
import { bobberBobs, bobberLands, bobberNibbled, fishBites, fishFlees, fishLeaps, reelWake } from "./fishingFx";

/** The sprite rows and faces of the particles written, in draw order. */
function drawn(pool: ParticlePool) {
  pool.write(0, 8, -10, 0, -0.5, 0.85);
  return Array.from({ length: pool.count }, (_, o) => ({ row: Math.floor(pool.b[o * 4 + 3] / PACK_COLS), face: pool.d[o * 4 + 3], y: pool.a[o * 4 + 1], ground: pool.a[o * 4 + 3] }));
}

describe("the water's answer to a cast", () => {
  it("lands as drops and rings on the water, never flat UI rings", () => {
    const pool = new ParticlePool(64);
    bobberLands(pool, 2, -0.1, 3);
    const p = drawn(pool);
    expect(p.some(q => q.row === PACK.droplets.row)).toBe(true);
    expect(p.filter(q => q.row === PACK.ripple.row).length).toBeGreaterThanOrEqual(1);
    // The rings lie on the water (face 1), on its surface.
    for (const q of p.filter(q => q.row === PACK.ripple.row)) { expect(q.face).toBe(1); expect(q.ground).toBeCloseTo(-0.1); }
  });
  it("bites with a crown of water standing on the surface, drops and a wide ring; a catch's crown is bigger", () => {
    const bite = new ParticlePool(64), leap = new ParticlePool(64);
    fishBites(bite, 0, 0, 0);
    fishLeaps(leap, 0, 0, 0);
    const crown = (pool: ParticlePool) => { const p = drawn(pool); const i = p.findIndex(q => q.row === PACK.splash.row); return { q: p[i], size: pool.b[i * 4] }; };
    expect(crown(bite).q.face).toBe(3); // standing on the water
    expect(crown(leap).size).toBeGreaterThan(crown(bite).size);
    expect(drawn(bite).filter(q => q.row === PACK.droplets.row).length).toBeGreaterThanOrEqual(6);
  });
  it("nibbles, bobs, wakes and flees as smaller touches", () => {
    const pool = new ParticlePool(64);
    bobberNibbled(pool, 0, 0, 0, 1);
    bobberBobs(pool, 0, 0, 0, 2);
    reelWake(pool, 0, 0, 0, 1, 0, 3, true);
    fishFlees(pool, 0, 0, 0, 0, 1);
    const p = drawn(pool);
    expect(p.filter(q => q.row === PACK.ripple.row).length).toBeGreaterThanOrEqual(4);
    expect(p.every(q => q.row !== PACK.splash.row)).toBe(true);
  });
  it("throws the same water for the same event at the same spot (every client), and different water for the next nibble", () => {
    const run = (n: number) => { const pool = new ParticlePool(32); bobberNibbled(pool, 1.25, -0.08, 4.5, n); pool.update(0.1, 0.3, 0); pool.write(0, 8, -10, 0, -0.5, 0.85); return Array.from(pool.a.slice(0, pool.count * 4)); };
    expect(run(1)).toEqual(run(1));
    expect(run(2)).not.toEqual(run(1));
  });
});
