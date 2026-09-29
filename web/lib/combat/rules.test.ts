import { describe, expect, it } from "vitest";
import { ENEMIES, MISSIONS } from "./content";
import { RUNES, resample, scoreTrace, potencyFor, type Pt, type TracePt } from "./incantation";
import { SUBCLASSES, subclassesFor } from "./kits";
import { applyEvent, applyEvents, canStart, initialProgress, type MissionEvent } from "./missions";
import { aggroStep, canDodge, DODGE, dodgeCancelsCast, hostileHitAllowed, isInvulnerable, type EnemyAggro } from "./movement";
import { allocate, derived, levelForXp, levelProgress, pointsEarned, presetAllocation, SUBCLASS_LEVEL, xpForLevel, xpToNext, ZERO_STATS, EVENT_XP, SESSION_XP, MAX_LEVEL } from "./progression";
import { damage, repairCost, wear, WEAPONS } from "./weapons";

describe("XP curve", () => {
  it("is strictly increasing, reaches 10 at 11,625 XP and caps at 50", () => {
    for (let l = 1; l < 49; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(125);
    expect(xpForLevel(SUBCLASS_LEVEL)).toBe(11625);
    expect(levelForXp(11624)).toBe(9);
    expect(levelForXp(11625)).toBe(10);
    expect(levelForXp(1e12)).toBe(MAX_LEVEL);
    expect(levelProgress(200)).toMatchObject({ level: 2, into: 75, needed: 300 - 0 });
  });
  it("makes a club event worth several ordinary sessions (row 23)", () => {
    expect(EVENT_XP / SESSION_XP).toBeGreaterThanOrEqual(4);
    expect(Math.ceil(xpForLevel(10) / SESSION_XP)).toBeGreaterThan(20);
  });
});

describe("stat allocation", () => {
  it("earns 3 points per level and refuses overspending, negatives and unknown stats", () => {
    expect(pointsEarned(1)).toBe(0);
    expect(pointsEarned(10)).toBe(27);
    expect(allocate(ZERO_STATS, { might: 3 }, 1)).toMatchObject({ ok: false });
    const a = allocate(ZERO_STATS, { might: 10, vitality: 5 }, 6);
    expect(a).toMatchObject({ ok: true, stats: { might: 10, vitality: 5 } });
    if (a.ok) expect(allocate(a.stats, { finesse: 1 }, 6)).toMatchObject({ ok: false, error: "You have 0 points to spend." });
    expect(allocate(ZERO_STATS, { might: -1 }, 10)).toMatchObject({ ok: false });
    expect(allocate(ZERO_STATS, { luck: 1 }, 10)).toMatchObject({ ok: false });
  });
  it("presets spend exactly the available points, weighted to the family", () => {
    for (const fam of ["Arcane", "Ranger", "Vanguard", "Warden"]) {
      const p = presetAllocation(fam, 10);
      expect(Object.values(p).reduce((a, b) => a + b, 0)).toBe(27);
    }
    expect(presetAllocation("Arcane", 10).arcana).toBeGreaterThan(presetAllocation("Arcane", 10).might);
    expect(derived({ ...ZERO_STATS, spirit: 10 }, 10).summon_capacity).toBe(4);
  });
});

describe("damage and durability", () => {
  const sword = WEAPONS.find((w) => w.key === "sword-iron")!;
  const staff = WEAPONS.find((w) => w.key === "staff-oak")!;
  it("scales with the weapon's stat, tier, crit, potency and defense", () => {
    const base = damage({ weapon: sword, durability: 100, stats: ZERO_STATS, level: 1, enemyDefense: 0 });
    expect(base).toBe(14);
    expect(damage({ weapon: sword, durability: 100, stats: { ...ZERO_STATS, might: 20 }, level: 1, enemyDefense: 0 })).toBeGreaterThan(base);
    expect(damage({ weapon: sword, durability: 100, stats: { ...ZERO_STATS, arcana: 20 }, level: 1, enemyDefense: 0 })).toBe(base); // wrong stat does nothing
    expect(damage({ weapon: staff, durability: 90, stats: { ...ZERO_STATS, arcana: 20 }, level: 1, enemyDefense: 0, potency: 1.5 })).toBe(Math.round(10 * 1.5 * 1.01 * 1.5));
    expect(damage({ weapon: sword, durability: 100, stats: ZERO_STATS, level: 1, enemyDefense: 0.45, crit: true })).toBe(Math.round(14 * 1.01 * 1.75 * 0.55));
    expect(damage({ weapon: sword, durability: 0, stats: ZERO_STATS, level: 1, enemyDefense: 0 })).toBe(7); // broken: half
    expect(damage({ weapon: sword, durability: 100, stats: ZERO_STATS, level: 1, enemyDefense: 5 })).toBeGreaterThanOrEqual(1);
  });
  it("wears 1 per hit, 10% of max on defeat, never below 0, and repair costs by tier", () => {
    expect(wear(sword, 120, 5, false)).toBe(115);
    expect(wear(sword, 120, 0, true)).toBe(108);
    expect(wear(sword, 3, 10, true)).toBe(0);
    expect(repairCost(sword, 100)).toBe(20 * 2);
  });
});

describe("dodge and aggro", () => {
  it("has an i-frame window, a cooldown, and cancels casting", () => {
    expect([0, 59, 60, 200, 319, 320].map((t) => isInvulnerable(1000, 1000 + t))).toEqual([false, false, true, true, true, false]);
    expect(isInvulnerable(null, 5)).toBe(false);
    expect(canDodge(1000, 1000 + DODGE.cooldown_ms - 1)).toBe(false);
    expect(dodgeCancelsCast(true)).toEqual({ cancelled: true });
  });
  it("chases outside the village, gives up at the boundary or leash, and heals on returning home", () => {
    const village = { contains: (p: { x: number; z: number }) => p.x < 0 };
    let e: EnemyAggro = { state: "idle", home: { x: 10, z: 0 }, pos: { x: 10, z: 0 }, hp: 100, max_hp: 100, aggro_radius: 6, attack_range: 1.5, leash_radius: 18 };
    e = aggroStep(e, { x: 20, z: 0 }, village);
    expect(e.state).toBe("idle");
    e = aggroStep(e, { x: 14, z: 0 }, village);
    expect(e.state).toBe("chase");
    e = aggroStep({ ...e, pos: { x: 3, z: 0 }, hp: 40 }, { x: -1, z: 0 }, village); // player steps into the village
    expect(e.state).toBe("return");
    e = aggroStep({ ...e, pos: { x: 10.2, z: 0 } }, { x: -1, z: 0 }, village);
    expect(e).toMatchObject({ state: "idle", hp: 100 });
    expect(hostileHitAllowed({ x: -2, z: 0 }, village)).toBe(false);
    const leashed = aggroStep({ ...e, state: "chase", pos: { x: 40, z: 0 } }, { x: 45, z: 0 }, village);
    expect(leashed.state).toBe("return");
  });
});

// ── Incantations ─────────────────────────────────────────────────────────────
const [spark, binding] = RUNES;
function traceOf(strokes: Pt[][], opts: { step?: number; noise?: number; ms?: number } = {}): TracePt[][] {
  let t = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  return strokes.map((s) =>
    resample(s, opts.step ?? 0.01).map((p) => ({ x: p.x + rnd() * (opts.noise ?? 0), y: p.y + rnd() * (opts.noise ?? 0), t: (t += opts.ms ?? 8) })),
  );
}

describe("incantation scoring", () => {
  it("rates a clean trace of either rune as enhanced", () => {
    expect(scoreTrace(spark, traceOf(spark.strokes, { noise: 0.02 }))).toMatchObject({ outcome: "enhanced", potency: 1.5 });
    expect(scoreTrace(binding, traceOf(binding.strokes, { noise: 0.02 }))).toMatchObject({ outcome: "enhanced" });
  });
  it("doesn't depend on the input sampling rate", () => {
    // Same drawing speed, different pointer sampling (points per ms).
    const coarse = scoreTrace(spark, traceOf(spark.strokes, { step: 0.08, noise: 0.03, ms: 0.08 * 800 })).accuracy;
    const fine = scoreTrace(spark, traceOf(spark.strokes, { step: 0.004, noise: 0.03, ms: 0.004 * 800 })).accuracy;
    expect(Math.abs(coarse - fine)).toBeLessThan(4);
  });
  it("scores a half trace as a weak cast and a tiny partial as a fizzle", () => {
    const half = scoreTrace(spark, traceOf([spark.strokes[0].slice(0, 3)]));
    expect(half.outcome).toBe("cast");
    expect(half.accuracy).toBeLessThan(80);
    const tiny = scoreTrace(spark, traceOf([[spark.strokes[0][0], { x: 0.3, y: 0.15 }]]));
    expect(tiny.outcome).toBe("fizzle");
  });
  it("fizzles a scribble across the whole guide", () => {
    const zig: Pt[] = [];
    for (let i = 0; i <= 20; i++) zig.push({ x: i % 2 ? 0.95 : 0.05, y: i / 20 });
    const s = scoreTrace(spark, traceOf([zig], { ms: 1 }));
    expect(s.outcome).toBe("fizzle");
    expect(s.parts.ink_ratio).toBeGreaterThan(3);
    const blob: Pt[] = [];
    for (let i = 0; i < 400; i++) blob.push({ x: 0.5 + 0.4 * Math.cos(i * 0.9), y: 0.5 + 0.4 * Math.sin(i * 1.3) });
    expect(scoreTrace(binding, traceOf([blob], { ms: 0.2 })).outcome).toBe("fizzle");
  });
  it("punishes wrong stroke order and direction but not to zero", () => {
    const reversed = scoreTrace(spark, traceOf([[...spark.strokes[0]].reverse()]));
    expect(reversed.parts.order).toBe(0);
    expect(reversed.outcome).toBe("cast");
    const shuffled = scoreTrace(binding, traceOf([binding.strokes[2], binding.strokes[0], binding.strokes[1]]));
    expect(shuffled.accuracy).toBeLessThan(scoreTrace(binding, traceOf(binding.strokes)).accuracy);
    expect(shuffled.outcome).not.toBe("enhanced");
  });
  it("fails past the rune's time limit and on an empty trace", () => {
    expect(scoreTrace(spark, traceOf(spark.strokes, { ms: 200 })).outcome).toBe("timeout");
    expect(scoreTrace(binding, []).outcome).toBe("fizzle");
  });
  it("maps accuracy to potency at the 50 / 95 thresholds (row C2)", () => {
    expect([potencyFor(49.9), potencyFor(50), potencyFor(72.5), potencyFor(94.9), potencyFor(95)]).toEqual([
      { outcome: "fizzle", potency: 0 }, { outcome: "cast", potency: 0.5 }, { outcome: "cast", potency: 0.75 }, { outcome: "cast", potency: 1 }, { outcome: "enhanced", potency: 1.5 },
    ]);
  });
});

describe("content", () => {
  it("has 16 subclasses, 4 per family, each with one signature and one passive", () => {
    expect(SUBCLASSES).toHaveLength(16);
    for (const f of ["Arcane", "Ranger", "Vanguard", "Warden"] as const) expect(subclassesFor(f)).toHaveLength(4);
    expect(new Set(SUBCLASSES.map((s) => s.key)).size).toBe(16);
    expect(SUBCLASSES.filter((s) => s.signature.incantation).every((s) => ["spark", "binding"].includes(s.signature.incantation!))).toBe(true);
    expect(SUBCLASSES.find((s) => s.key === "necromancer")!.starter_note).toBeTruthy();
    expect(SUBCLASSES.find((s) => s.key === "transmuter")!.starter_note).toBeTruthy();
  });
  it("has 5 enemy types, 2 elites, 1 boss and 10 missions over the four templates (rows 213, 231)", () => {
    expect(ENEMIES.filter((e) => e.kind === "normal")).toHaveLength(5);
    expect(ENEMIES.filter((e) => e.kind === "elite")).toHaveLength(2);
    expect(ENEMIES.filter((e) => e.kind === "boss")).toHaveLength(1);
    expect(MISSIONS).toHaveLength(10);
    expect(new Set(MISSIONS.map((m) => m.template))).toEqual(new Set(["hunt", "fetch", "survive", "escort"]));
    for (const m of MISSIONS.filter((x) => x.template === "hunt")) expect(ENEMIES.some((e) => e.key === m.params.enemy)).toBe(true);
  });
});

describe("mission state machines", () => {
  const def = (k: string) => MISSIONS.find((m) => m.key === k)!;
  const kill = (id: string, enemy = "shadow-fox"): MissionEvent => ({ id, type: "kill", enemy });
  it("hunt counts each kill event once and ignores other enemies", () => {
    const d = def("hunt-foxes");
    let p = applyEvents(d, initialProgress(), [kill("k1"), kill("k1"), kill("k2", "thorn-crab"), kill("k3")]);
    expect(p).toMatchObject({ counter: 2, state: "active" });
    p = applyEvents(d, p, ["k4", "k5", "k6", "k7", "k8"].map((id) => kill(id)));
    expect(p).toMatchObject({ counter: 6, state: "ready" });
    expect(applyEvent(d, p, kill("k9"))).toBe(p);
  });
  it("fetch drops the item on defeat and needs it on return", () => {
    const d = def("fetch-lantern");
    let p = applyEvents(d, initialProgress(), [{ id: "a", type: "pickup", item: "old-lantern" }, { id: "b", type: "defeat" }, { id: "c", type: "return" }]);
    expect(p).toMatchObject({ state: "active", carrying: false });
    p = applyEvents(d, p, [{ id: "d", type: "pickup", item: "old-lantern" }, { id: "e", type: "return" }]);
    expect(p.state).toBe("ready");
  });
  it("survive needs waves in order and fails on defeat", () => {
    const d = def("survive-circle");
    const p = applyEvents(d, initialProgress(), [{ id: "w2", type: "wave_cleared", wave: 2 }, { id: "w1", type: "wave_cleared", wave: 1 }]);
    expect(p.counter).toBe(1);
    expect(applyEvent(d, p, { id: "x", type: "defeat" }).state).toBe("failed");
    expect(applyEvents(d, p, [2, 3].map((w) => ({ id: `v${w}`, type: "wave_cleared", wave: w }) as MissionEvent)).state).toBe("ready");
  });
  it("escort needs every checkpoint before arriving and fails if the resident goes down", () => {
    const d = def("escort-botanist");
    let p = applyEvents(d, initialProgress(), [{ id: "c1", type: "checkpoint", n: 1 }, { id: "ar", type: "arrived" }]);
    expect(p.state).toBe("active");
    p = applyEvents(d, p, [{ id: "c2", type: "checkpoint", n: 2 }, { id: "c3", type: "checkpoint", n: 3 }, { id: "ar2", type: "arrived" }]);
    expect(p.state).toBe("ready");
    expect(applyEvent(d, initialProgress(), { id: "dn", type: "escort_down" }).state).toBe("failed");
  });
  it("repeats only after the cooldown and never twice at once", () => {
    const d = def("hunt-foxes");
    const now = new Date("2026-09-26T12:00:00Z");
    expect(canStart(d, null, true, now)).toMatchObject({ ok: false, reason: "active" });
    expect(canStart(d, "2026-09-26T00:00:00Z", false, now)).toMatchObject({ ok: false, reason: "cooldown" });
    expect(canStart(d, "2026-09-25T10:00:00Z", false, now)).toEqual({ ok: true });
  });
});
