import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { HolderPool, POOL_KINDS, seeded, throwKind, throwStrike, type Ctx, type Holder, type PoolKind } from "./holder";

/** A stand-in holder: a straight stick 1 tall up +y, its surface points round it. */
function stick(): Holder {
  const n = 32;
  return {
    n, size: 1, right: new THREE.Vector3(1, 0, 0),
    point: (i, out) => out.set(Math.cos(i) * 0.02, i / (n - 1), Math.sin(i) * 0.02),
    normal: (i, out) => out.set(Math.cos(i), 0, Math.sin(i)),
    along: (s, out) => out.set(0, s, 0),
  };
}
function run(kind: PoolKind, seconds: number, k = 1) {
  const pool = new HolderPool(320), rnd = seeded(7), state = {}, holder = stick(), dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const c: Ctx = { pool, rnd, holder, ramp: 1, k, t, dt, state };
    throwKind(kind, c);
    pool.step(dt);
  }
  return pool;
}
const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(1, 0, 0);
const ys = (pool: HolderPool) => { const n = pool.write(right, up), out: number[] = []; for (let i = 0; i < n; i++) out.push(pool.a[i * 4 + 1]); return out; };

describe("the effects library on any holder (lib/game/fx/holder.ts)", () => {
  it("every running type keeps its holder's pool alive and within its capacity, more of it at a higher strength", () => {
    for (const kind of POOL_KINDS.filter(k => k !== "sparks" && k !== "burst")) {
      const one = run(kind, 3).alive, more = run(kind, 3, 2.5).alive;
      expect(one, kind).toBeGreaterThan(0);
      expect(more, kind).toBeLessThanOrEqual(320);
      expect(more, kind).toBeGreaterThanOrEqual(one);
    }
  });
  it("flames and embers rise off it; petals drift and fall, slowly", () => {
    const flame = ys(run("flame", 2)), petals = ys(run("petals", 4));
    expect(Math.max(...flame)).toBeGreaterThan(1);              // above the stick's tip
    expect(Math.min(...petals)).toBeLessThan(0);                 // some have fallen past its foot
    expect(Math.min(...petals)).toBeGreaterThan(-2);             // but drifting, not dropping
  });
  it("lays a bolt from one point to the other on screen", () => {
    const pool = new HolderPool(4), rnd = seeded(1);
    pool.emit({ sprite: "bolt", x: 0, y: 0, z: 0, to: [0, 1, 0], size: 0.05, life: 1, ramp: 0 }, rnd);
    pool.write(right, up);
    expect(pool.a[1]).toBeCloseTo(0.5);                          // its middle
    expect(pool.b[0]).toBeCloseTo(1);                            // its span
    expect(pool.b[2]).toBeCloseTo(Math.PI / 2);                  // turned to it
  });
  it("strikes: lightning crackles at the tip, then comes down from above it; a wave comes in from the side and crashes", () => {
    const pool = new HolderPool(320), rnd = seeded(3), holder = stick(), state: Record<string, number> = {};
    const at = (t: number) => throwStrike("lightning", { pool, rnd, holder, ramp: 0, k: 1, t, dt: 1 / 60, state }, t, 0.5);
    for (let t = 0; t < 0.5; t += 1 / 60) at(t);
    const before = pool.alive;
    at(0.5);
    expect(pool.alive).toBeGreaterThan(before + 7);
    expect(Math.max(...ys(pool))).toBeGreaterThan(2);           // out of the sky
    const wave = new HolderPool(64), ws: Record<string, number> = {};
    throwStrike("wave", { pool: wave, rnd, holder, ramp: 0, k: 1, t: 0, dt: 1 / 60, state: ws }, 0, 0.5);
    wave.write(right, up);
    expect(wave.a[0]).toBeLessThan(0);                           // from the left of what you see
    throwStrike("wave", { pool: wave, rnd, holder, ramp: 0, k: 1, t: 0.5, dt: 1 / 60, state: ws }, 0.5, 0.5);
    expect(wave.alive).toBeGreaterThan(10);                      // its spray
  });
});
