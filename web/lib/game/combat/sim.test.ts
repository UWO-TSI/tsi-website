import { describe, expect, it } from "vitest";
import { ENEMIES } from "./data";
import { DODGE, WANDER, damageEnemy, inArc, invulnerable, spawnEnemy, stepEnemy, strikeLands, sweptHit } from "./sim";
import { stepCombat } from "./encounter";
import { createRuntime } from "./runtime";
import { packAt } from "./spawns";

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
    const e = spawnEnemy("s1", ENEMIES["thorn-crab"], 0, 0);
    expect(run(e, { x: 0, z: 10 }, 0.5)).toHaveLength(0);
    expect(e.state).toBe("idle");
    e.facing = 0;
    const events = run(e, { x: 0, z: 0.9 }, 1.5);
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
  it("casters fire from range instead of closing in", () => {
    const w = spawnEnemy("w2", ENEMIES["rune-wisp"], 0, 0);
    expect(run(w, { x: 0, z: 5 }, 2)[0]).toMatchObject({ kind: "spit", to: { x: 0, z: 5 } });
    const m = spawnEnemy("m2", ENEMIES["mushroom-beast"], 0, 0);
    expect(run(m, { x: 0, z: 5 }, 2.5)[0]).toMatchObject({ kind: "lob", to: { x: 0, z: 5 } });
  });
});

describe("pack AI (combat polish 5)", () => {
  const lcg = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  it("a pack chasing you keeps a separation radius instead of stacking on one spot", () => {
    const rt = createRuntime();
    rt.player.safe = false; rt.player.maxHp = rt.player.hp = 1e6;
    rt.enemies = [[-0.2, 6], [0.2, 6.1], [0, 5.8], [0.1, 6.3], [-0.1, 6.2]].map(([x, z], i) => ({ ...spawnEnemy(`f${i}`, ENEMIES["animated-book"], x, z), state: "chase" as const }));
    let closest = Infinity;
    for (let t = 0; t < 6; t += 1 / 60) {
      stepCombat(rt, { x: 0, z: 0 }, 1 / 60, () => true, lcg(7));
      if (t > 1.5) for (const [i, a] of rt.enemies.entries()) for (const b of rt.enemies.slice(i + 1)) closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
    }
    const r = ENEMIES["animated-book"].radius;
    expect(closest).toBeGreaterThan(2 * r * 0.9);
    expect(rt.enemies.every(e => Math.hypot(e.x, e.z) < 4)).toBe(true); // still on you, just not on top of each other
  });
  it("a fox den waiting its turn keeps apart too (only a pounce passes through)", () => {
    const rt = createRuntime();
    rt.player.safe = false; rt.player.maxHp = rt.player.hp = 1e6;
    rt.enemies = packAt("den", "shadow-fox", 0, 6, 3).map(s => spawnEnemy(s.id, ENEMIES[s.type], s.x, s.z, s.pack));
    let closest = Infinity;
    for (let t = 0; t < 6; t += 1 / 60) {
      stepCombat(rt, { x: 0, z: 0 }, 1 / 60, () => true, lcg(7));
      const waiting = rt.enemies.filter(e => e.state === "chase");
      if (t > 1.5) for (const [i, a] of waiting.entries()) for (const b of waiting.slice(i + 1)) closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
    }
    expect(closest).toBeGreaterThan(2 * ENEMIES["shadow-fox"].radius * 0.9);
  });
  it("an idle enemy wanders a little near its spawn, and still aggroes when you come close", () => {
    const e = spawnEnemy("c", ENEMIES["thorn-crab"], 10, 10), random = lcg(3), far = { x: 40, z: 40, safe: false, alive: true };
    let furthest = 0, moved = 0, lastX = e.x, lastZ = e.z;
    for (let t = 0; t < 30; t += 1 / 30) {
      stepEnemy(e, far, 1 / 30, () => true, random);
      furthest = Math.max(furthest, Math.hypot(e.x - 10, e.z - 10));
      moved += Math.hypot(e.x - lastX, e.z - lastZ); lastX = e.x; lastZ = e.z;
    }
    expect(e.state).toBe("idle");
    expect(moved).toBeGreaterThan(2); // it strolls, it doesn't stand still
    expect(furthest).toBeLessThanOrEqual(WANDER.radius + 0.01);
    stepEnemy(e, { x: e.x + 2, z: e.z, safe: false, alive: true }, 1 / 30, () => true, random);
    expect(e.state).toBe("chase");
    const boss = spawnEnemy("b", ENEMIES["guardian-statue"], 0, 0);
    for (let t = 0; t < 10; t += 1 / 30) stepEnemy(boss, far, 1 / 30, () => true, random);
    expect([boss.x, boss.z]).toEqual([0, 0]); // the guardian keeps its plinth
  });
});
