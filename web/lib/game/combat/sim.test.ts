import { describe, expect, it } from "vitest";
import { ENEMIES } from "./data";
import { DODGE, damageEnemy, inArc, invulnerable, spawnEnemy, stepEnemy, strikeLands, sweptHit } from "./sim";

const run = (e: ReturnType<typeof spawnEnemy>, p: { x: number; z: number; safe?: boolean }, seconds: number, dt = 1 / 60) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) { const ev = stepEnemy(e, { ...p, safe: !!p.safe, alive: true }, dt); if (ev) events.push(ev); }
  return events;
};

describe("hit detection", () => {
  it("melee arcs hit in front, miss behind and out of reach, and count the target's radius", () => {
    const o = { x: 0, z: 0 };
    expect(inArc(o, 0, 1.7, 1.9, { x: 0, z: 1.5 })).toBe(true);
    expect(inArc(o, 0, 1.7, 1.9, { x: 0, z: -1 })).toBe(false);
    expect(inArc(o, 0, 1.7, 1.9, { x: 0, z: 2.5 })).toBe(false);
    expect(inArc(o, 0, 1.7, 1.9, { x: 0, z: 2.1 }, 0.5)).toBe(true);
    expect(inArc(o, 0, 1.7, 1.9, { x: 1.3, z: 0.4 })).toBe(false);
    expect(inArc(o, 0, 1.7, 1.9, { x: 1.3, z: 0.4 }, 0.6)).toBe(true);
    expect(inArc(o, 0, 2, Math.PI * 2, { x: -1, z: -1 })).toBe(true);
  });
  it("fast projectiles can't tunnel through a target between frames", () => {
    expect(sweptHit({ x: 0, z: -2 }, { x: 0, z: 2 }, { x: 0.3, z: 0 }, 0.4)).toBe(true);
    expect(sweptHit({ x: 0, z: -2 }, { x: 0, z: 2 }, { x: 1, z: 0 }, 0.4)).toBe(false);
    expect(sweptHit({ x: 0, z: -2 }, { x: 0, z: -1 }, { x: 0, z: 0 }, 0.4)).toBe(false);
  });
});

describe("dodge", () => {
  it("is invulnerable only inside the i-frame window", () => {
    expect(invulnerable(null)).toBe(false);
    expect(invulnerable(0)).toBe(false);
    expect(invulnerable(DODGE.iframeStart)).toBe(true);
    expect(invulnerable(0.2)).toBe(true);
    expect(invulnerable(DODGE.iframeEnd + 0.01)).toBe(false);
    expect(DODGE.iframeEnd).toBeLessThan(DODGE.duration);
  });
});

describe("enemy behaviour", () => {
  it("aggroes, telegraphs, then strikes where it aimed", () => {
    const e = spawnEnemy("s1", ENEMIES["shadow-fox"], 0, 0);
    expect(run(e, { x: 0, z: 10 }, 0.5)).toHaveLength(0);
    expect(e.state).toBe("idle");
    const events = run(e, { x: 0, z: 3 }, 1.5);
    expect(events[0]).toMatchObject({ kind: "strike" });
    expect(strikeLands(e, { x: e.x, z: e.z + 1 })).toBe(true);
    expect(strikeLands(e, { x: e.x, z: e.z - 1.2 })).toBe(false);
  });
  it("resets and heals when the player reaches the safe zone or it is dragged past its leash", () => {
    const e = spawnEnemy("t1", ENEMIES["thorn-crab"], 0, 0);
    run(e, { x: 0, z: 3 }, 0.3);
    damageEnemy(e, 20, { x: 0, z: 3 }, 0);
    expect(e.hp).toBe(70);
    const events = run(e, { x: 0, z: 3, safe: true }, 3);
    expect(events.some(ev => ev.kind === "reset")).toBe(true);
    expect(e).toMatchObject({ state: "idle", hp: 90 });
    const f = spawnEnemy("t2", ENEMIES["thorn-crab"], 0, 0);
    f.state = "chase"; f.x = 0; f.z = 13;
    run(f, { x: 0, z: 20 }, 0.1);
    expect(f.state).toBe("return");
    expect(damageEnemy(f, 999, { x: 0, z: 20 }, 0)).toBe(false);
  });
  it("dies at zero and stops acting; bosses barely budge", () => {
    const e = spawnEnemy("w1", ENEMIES["mushroom-beast"], 0, 0);
    expect(damageEnemy(e, 110, { x: 0, z: -1 }, 3)).toBe(true);
    expect(run(e, { x: 0, z: 1 }, 1)).toHaveLength(0);
    const b = spawnEnemy("b", ENEMIES["guardian-statue"], 0, 0);
    damageEnemy(b, 10, { x: 0, z: -1 }, 7);
    expect(Math.hypot(b.kx, b.kz)).toBeLessThan(1);
  });
  it("spitters fire from range instead of closing in", () => {
    const e = spawnEnemy("w2", ENEMIES["mushroom-beast"], 0, 0);
    const events = run(e, { x: 0, z: 4.5 }, 2.5);
    expect(events[0]).toMatchObject({ kind: "spit", to: { x: 0, z: 4.5 } });
  });
});
