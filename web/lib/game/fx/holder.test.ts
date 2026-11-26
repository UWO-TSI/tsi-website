import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { HUSH, HolderPool, POOL_KINDS, ZAP_AT, chargeAt, seeded, throwKind, throwStrike, throwWater, type Ctx, type Holder, type PoolKind } from "./holder";

/** A stand-in holder: a straight stick 1 tall up +y, its surface points round it, swung sideways at `swing` a second. */
function stick(swing = 0): Holder {
  const n = 32;
  return {
    n, size: 1, right: new THREE.Vector3(1, 0, 0),
    point: (i, out) => out.set(Math.cos(i) * 0.02, i / (n - 1), Math.sin(i) * 0.02),
    normal: (i, out) => out.set(Math.cos(i), 0, Math.sin(i)),
    along: (s, out) => out.set(0, s, 0),
    vel: (s, out) => out.set(swing * s, 0, 0),
  };
}
function run(kind: PoolKind, seconds: number, k = 1) {
  const pool = new HolderPool(320), rnd = seeded(7), state = {}, holder = stick(), dt = 1 / 60;
  let lived = 0;
  for (let t = 0; t < seconds; t += dt) {
    const c: Ctx = { pool, rnd, holder, ramp: 1, k, t, dt, state };
    throwKind(kind, c);
    pool.step(dt, AXIS);
    lived += pool.alive;
  }
  return Object.assign(pool, { lived });
}
const AXIS = { a: new THREE.Vector3(0, 0, 0), b: new THREE.Vector3(0, 1, 0) };
const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(1, 0, 0);
const ys = (pool: HolderPool) => { const n = pool.write(right, up), out: number[] = []; for (let i = 0; i < n; i++) out.push(pool.a[i * 4 + 1]); return out; };

describe("the effects library on any holder (lib/game/fx/holder.ts)", () => {
  it("every running type keeps its holder's pool alive and within its capacity, more of it at a higher strength", () => {
    for (const kind of POOL_KINDS.filter(k => k !== "sparks" && k !== "burst")) {
      const one = run(kind, 3), more = run(kind, 3, 2.5);
      expect(one.lived, kind).toBeGreaterThan(0);
      expect(more.alive, kind).toBeLessThanOrEqual(320);
      expect(more.lived, kind).toBeGreaterThanOrEqual(one.lived);
    }
  });
  it("flames rise off it; petals swirl round it and lift on the wind, never falling; embers fly every way, not in a ring", () => {
    const flame = ys(run("flame", 2)), petals = ys(run("petals", 4));
    expect(Math.max(...flame)).toBeGreaterThan(1);              // above the stick's tip
    expect(Math.min(...petals)).toBeGreaterThan(-0.05);          // none fall past its foot
    const pool = run("petals", 1.5), n = pool.write(right, up);
    for (let i = 0; i < n; i++) expect(Math.hypot(pool.a[i * 4], pool.a[i * 4 + 2]), "steered round it").toBeLessThan(0.6);
    const embers = run("embers", 1), m = embers.write(right, up), angles = new Set<number>();
    for (let i = 0; i < m; i++) angles.add(Math.round(embers.b[i * 4 + 2] * 2));
    expect(angles.size, "streaked along their own flights").toBeGreaterThanOrEqual(3);
  });
  it("electricity builds its charge, then zaps the length of it", () => {
    expect(chargeAt(0, 1)).toBe(0);
    const pool = new HolderPool(320), rnd = seeded(5), holder = stick(), state: Record<string, number> = {}, dt = 1 / 60;
    let t = 0, before = 0;
    for (; chargeAt(t + dt, 1) < ZAP_AT; t += dt) { throwKind("electricity", { pool, rnd, holder, ramp: 0, k: 1, t, dt, state }); pool.step(dt); }
    before = pool.alive;
    t += dt;
    throwKind("electricity", { pool, rnd, holder, ramp: 0, k: 1, t, dt, state });
    expect(pool.alive).toBeGreaterThan(before + 15);             // the zap: one arc base to tip, its flare and sparks
    expect(Math.max(...ys(pool))).toBeGreaterThan(0.95);
  });
  it("the water throws more drops the faster it swings, and drips fall", () => {
    const drops = (swing: number) => {
      const pool = new HolderPool(400), rnd = seeded(2), holder = stick(swing), state: Record<string, number> = {};
      for (let t = 0; t < 1; t += 1 / 60) { throwWater({ pool, rnd, holder, ramp: 0, k: 1, t, dt: 1 / 60, state }, 0.03); pool.step(1 / 60); }
      return pool;
    };
    expect(drops(4).alive).toBeGreaterThan(drops(0).alive * 2);
    expect(Math.min(...ys(drops(0)))).toBeLessThan(-0.05);         // drips fallen below it
  });
  it("lays a bolt from one point to the other on screen", () => {
    const pool = new HolderPool(4), rnd = seeded(1);
    pool.emit({ sprite: "bolt", x: 0, y: 0, z: 0, to: [0, 1, 0], size: 0.05, life: 1, ramp: 0 }, rnd);
    pool.write(right, up);
    expect(pool.a[1]).toBeCloseTo(0.5);                          // its middle
    expect(pool.b[0]).toBeCloseTo(1);                            // its span
    expect(pool.b[2]).toBeCloseTo(Math.PI / 2);                  // turned to it
  });
  it("strikes: lightning charges at the tip, holds its breath, then comes down from above it", () => {
    const pool = new HolderPool(4000), rnd = seeded(3), holder = stick(), state: Record<string, number> = {};
    const at = (t: number) => throwStrike("lightning", { pool, rnd, holder, ramp: 0, k: 1, t, dt: 1 / 60, state }, t, 1);
    for (let t = 0; t < 1 - HUSH; t += 1 / 60) at(t);
    expect(pool.alive).toBeGreaterThan(0);
    const charged = pool.alive;
    for (let t = 1 - HUSH + 0.01; t < 1; t += 1 / 60) at(t);
    expect(pool.alive).toBe(charged);                            // the held breath: nothing new
    at(1);
    expect(pool.alive).toBeGreaterThan(charged + 7);
    expect(Math.max(...ys(pool))).toBeGreaterThan(2);           // out of the sky
  });
});
