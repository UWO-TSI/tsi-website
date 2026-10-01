import { describe, expect, it } from "vitest";
import { FACE, ParticlePool, seedAt, type Recipe } from "./particles";
import { PACK, PACK_COLS } from "./pack";

const PUFF: Recipe = { sprite: "dust", count: [3, 4], life: [0.4, 0.6], size: [0.3, 0.4], grow: 1.5, speed: [1, 2], spread: 0.6, up: [0.2, 0.5], gravity: 0, drag: 4, wind: 0.6, lift: 0.2, alpha: 0.9, face: FACE.billboard };
const GRAINS: Recipe = { ...PUFF, sprite: "sand", gravity: 9, up: [1, 1], life: [2, 2] };
/** Sprite rows of the particles written last, in draw order. */
const rows = (p: ParticlePool) => Array.from({ length: p.count }, (_, o) => Math.floor(p.b[o * 4 + 3] / PACK_COLS));

describe("movement particle pool", () => {
  it("never allocates: a fixed ring of typed arrays that reuses the oldest slot", () => {
    const pool = new ParticlePool(32), arrays = [pool.a, pool.b, pool.c, pool.d];
    for (let k = 0; k < 50; k++) pool.burst(PUFF, k, 0, 0, 0, 1, 0, 1, 0xd8cfa8, k);
    expect(pool.alive).toBe(32);
    for (let f = 0; f < 30; f++) { pool.update(1 / 60, 1, 0); pool.write(0, 8, -10, 0, -0.5, 0.85); }
    expect([pool.a, pool.b, pool.c, pool.d]).toEqual(arrays);
    expect(pool.a.length).toBe(32 * 4);
    pool.update(1, 0, 0);
    expect(pool.alive).toBe(0);
  });

  it("is deterministic: the same event at the same spot throws the same particles", () => {
    const run = () => {
      const p = new ParticlePool(64);
      p.burst(PUFF, 3.2, 0, -1.5, 0, 0.6, 0.8, 1.2, 0xd8cfa8, seedAt(3.2, -1.5, 3));
      p.burst(GRAINS, 3.2, 0, -1.5, 0, 0, 0, 1, 0xefdcaa, seedAt(3.2, -1.5, 4));
      for (let f = 0; f < 20; f++) p.update(1 / 60, 0.8, 0.3);
      p.write(0, 8, -10, 0, -0.5, 0.85);
      return [Array.from(p.a), Array.from(p.b), Array.from(p.c)];
    };
    expect(run()).toEqual(run());
    expect(seedAt(1, 2, 3)).toBe(seedAt(1, 2, 3));
    expect(seedAt(1, 2, 3)).not.toBe(seedAt(1.5, 2, 3));
  });

  it("draws far to near and picks the sprite's row and frame over the life", () => {
    const pool = new ParticlePool(16);
    pool.burst({ ...PUFF, count: [1, 1], speed: [0, 0], up: [0, 0], lift: 0 }, 0, 0, 5, 0, 0, 0, 1, 0xffffff, 1);
    pool.burst({ ...PUFF, count: [1, 1], speed: [0, 0], up: [0, 0], lift: 0, sprite: "snow" }, 0, 0, 20, 0, 0, 0, 1, 0xffffff, 2);
    pool.write(0, 0, 0, 0, 0, 1);
    expect(rows(pool)).toEqual([PACK.snow.row, PACK.dust.row]); // the far one first
    expect(pool.b[3] % PACK_COLS).toBe(0);
    pool.update(0.39, 0, 0); // most of a 0.4..0.6 s life
    pool.write(0, 0, 0, 0, 0, 1);
    expect(pool.b[7] % PACK_COLS).toBeGreaterThan(4);
  });

  it("drifts with the wind, rises on its lift, and grains settle on the ground they were thrown from", () => {
    const pool = new ParticlePool(8);
    pool.burst({ ...PUFF, count: [1, 1], speed: [0, 0], up: [0, 0], life: [3, 3] }, 0, 0, 0, 0, 0, 0, 1, 0xffffff, 1);
    pool.burst({ ...GRAINS, count: [1, 1] }, 10, 1, 0, 1, 1, 0, 1, 0xffffff, 2);
    for (let f = 0; f < 90; f++) pool.update(1 / 60, 2, 0);
    pool.write(0, 0, -10, 0, 0, 1);
    const puff = rows(pool).indexOf(PACK.dust.row) * 4, grain = rows(pool).indexOf(PACK.sand.row) * 4;
    expect(pool.a[puff]).toBeGreaterThan(1); // downwind (+x)
    expect(pool.a[puff + 1]).toBeGreaterThan(0.1); // risen
    expect(pool.a[grain + 1]).toBeGreaterThanOrEqual(1); // never through its ground (y 1)
    expect(pool.a[grain + 1]).toBeLessThan(1.2);
  });

  it("lays a streak along its direction and turns a ground decal to it", () => {
    const pool = new ParticlePool(8);
    pool.burst({ ...PUFF, count: [1, 1], sprite: "streak", face: FACE.streak, speed: [0, 0] }, 0, 1, 0, 0, 0, 3, 1, 0xffffff, 1);
    pool.write(0, 5, -10, 0, 0, 1);
    expect([pool.d[0], pool.d[2], pool.d[3]]).toEqual([0, 1, FACE.streak]);
    pool.clear();
    pool.burst({ ...PUFF, count: [1, 1], sprite: "scuff", face: FACE.ground, speed: [0, 0] }, 0, 0, 0, 0, 1, 0, 1, 0xffffff, 1);
    pool.write(0, 5, -10, 0, 0, 1);
    // Local +x of the decal runs along (1, 0): rotation atan2(-z, x) = 0.
    expect(pool.b[2]).toBeCloseTo(0);
  });
});
