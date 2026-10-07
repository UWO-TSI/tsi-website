import { describe, expect, it } from "vitest";
import { fireflyOffset, fireflyOffsetInto } from "./fireflyPath";
import { FireflySwarm } from "./fireflySwarm";

describe("the fireflies' no-allocation path", () => {
  it("writes a firefly's offset into the caller's array and hands that same array back, as the old path computed it", () => {
    const out = new Float32Array(3);
    for (let seed = 1; seed <= 12; seed++) for (let t = 0; t < 40; t += 0.37) {
      expect(fireflyOffsetInto(seed, t, out, 0)).toBe(out);
      const ref = fireflyOffset(seed, t);
      expect(out[0]).toBeCloseTo(ref[0], 5); expect(out[1]).toBeCloseTo(ref[1], 5); expect(out[2]).toBeCloseTo(ref[2], 5);
    }
  });

  it("writes at an offset into one shared buffer, so a swarm keeps every firefly in one array", () => {
    const buf = new Float32Array(9);
    fireflyOffsetInto(3, 5, buf, 3);
    const ref = fireflyOffset(3, 5);
    expect([buf[0], buf[1], buf[2]]).toEqual([0, 0, 0]);
    expect(buf[3]).toBeCloseTo(ref[0], 5); expect(buf[5]).toBeCloseTo(ref[2], 5);
  });

  it("steps a whole swarm in its own buffers frame after frame (the same arrays, nothing new)", () => {
    const swarm = new FireflySwarm(30, [[0, 0], [5, 5], [-4, 2]]);
    const pos = swarm.positions, glow = swarm.glow, yaw = swarm.yaw;
    const ground = () => 1;
    for (let f = 0; f < 120; f++) swarm.step(f / 60, ground);
    expect(swarm.positions).toBe(pos); expect(swarm.glow).toBe(glow); expect(swarm.yaw).toBe(yaw);
    expect(pos.length).toBe(30 * 3);
  });

  it("keeps each firefly low over the ground near its bush, its glow pulsing on its own phase", () => {
    const swarm = new FireflySwarm(12, [[10, -3]]);
    let maxR = 0, low = Infinity, high = -Infinity;
    const lit = new Set<number>();
    for (let f = 0; f < 600; f++) {
      swarm.step(f / 30, () => 0.5);
      for (let i = 0; i < 12; i++) {
        maxR = Math.max(maxR, Math.hypot(swarm.positions[i * 3] - 10, swarm.positions[i * 3 + 2] + 3));
        low = Math.min(low, swarm.positions[i * 3 + 1]); high = Math.max(high, swarm.positions[i * 3 + 1]);
        lit.add(Math.round(swarm.glow[i] * 10));
      }
    }
    expect(maxR).toBeLessThan(1.4 * 1.1 + 1e-6);
    expect(low).toBeGreaterThanOrEqual(0.5 + 0.3 - 1e-6);
    expect(high).toBeLessThanOrEqual(0.5 + 1.1 + 1e-6);
    expect(lit.size).toBeGreaterThan(3);
  });

  it("is the same swarm for everyone at the same world second (seeded, on the shared clock)", () => {
    const a = new FireflySwarm(8, [[1, 1], [2, 2]]), b = new FireflySwarm(8, [[1, 1], [2, 2]]);
    a.step(123.4, () => 0); b.step(123.4, () => 0);
    expect([...a.positions]).toEqual([...b.positions]);
  });
});
