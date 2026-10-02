import { describe, expect, it } from "vitest";
import { abilityAt, CLASS_KITS, classKit, classMods, holdsSignature, kitAt, memberKit, nextUnlock, NEUTRAL_MODS, passiveAt, rankOf, signatureHint, statAt, unlocksAt, upgraded, type ClassAbility } from "./classes";
import { DEMO_KIT } from "./demoKit";
import { UNITS } from "./kits";

const all = (k: (typeof CLASS_KITS)[number]): ClassAbility[] => [...k.keys, ...(k.combos ?? []).map(c => c.ability), k.ult];

/** Every kit, now and in every family wave, keeps these (design sheet §1.1, §1.5, §1.6, §3 and the build overrides). */
describe("v2 kit invariants (every kit in CLASS_KITS)", () => {
  it("keys 1–5, all equipped; combos point at real keys", () => {
    for (const k of CLASS_KITS) {
      expect(k.keys.length, k.key).toBeGreaterThanOrEqual(1);
      expect(k.keys.length, k.key).toBeLessThanOrEqual(5);
      for (const c of k.combos ?? []) for (const i of c.keys) expect(k.keys[i], `${k.key} combo`).toBeDefined();
    }
  });
  it("ability keys are unique across every kit (none shared, row 286)", () => {
    const keys = CLASS_KITS.flatMap(k => all(k).map(a => a.key));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("one signature type per subclass, its own (dev kits aside)", () => {
    const types = CLASS_KITS.filter(k => !k.dev).map(k => k.signature.type);
    expect(new Set(types).size).toBe(types.length);
    for (const k of CLASS_KITS) expect(k.signature.name.length, k.key).toBeGreaterThan(0);
  });
  it("the ult: charge 0.8–1.25, anticipation 250–600 ms, no energy", () => {
    for (const k of CLASS_KITS) {
      expect(k.ult.charge).toBeGreaterThanOrEqual(0.8);
      expect(k.ult.charge).toBeLessThanOrEqual(1.25);
      expect(k.ult.anticipation_ms).toBeGreaterThanOrEqual(250);
      expect(k.ult.anticipation_ms).toBeLessThanOrEqual(600);
      expect(k.ult.energy).toBe(0);
    }
  });
  it("at most 2 heavy abilities and one i-frame ability (cooldown 8 s or more) a kit", () => {
    for (const k of CLASS_KITS) {
      const pool = [...k.keys, ...(k.combos ?? []).map(c => c.ability)];
      expect(pool.filter(a => a.heavy).length, k.key).toBeLessThanOrEqual(2);
      const iframes = pool.filter(a => a.effects.some(e => e.kind === "dash" && e.iframes));
      expect(iframes.length, k.key).toBeLessThanOrEqual(1);
      for (const a of iframes) expect(a.cooldown_s, a.key).toBeGreaterThanOrEqual(8);
    }
  });
  it("movement effects stay inside the hooks' limits: +4 u/s a cast, hops of 0.4–0.9 u", () => {
    for (const k of CLASS_KITS) for (const e of [...all(k), ...(k.movement ? [{ effects: k.movement.effects }] : [])].flatMap(a => a.effects)) {
      if (e.kind === "momentum") expect(e.speed).toBeLessThanOrEqual(4);
      if (e.kind === "launch") { expect(e.height).toBeGreaterThanOrEqual(0.4); expect(e.height).toBeLessThanOrEqual(0.9); }
    }
  });
  it("the track: unlocks and ranks inside 1–20, rank targets exist", () => {
    for (const k of CLASS_KITS) {
      for (const a of all(k)) expect(a.unlock ?? 1).toBeGreaterThanOrEqual(1);
      for (const a of all(k)) expect(a.unlock ?? 1).toBeLessThanOrEqual(20);
      const targets = new Set([...all(k).map(a => a.key), "ult", "passive"]);
      for (const r of k.ranks ?? []) { expect(targets.has(r.target), `${k.key} ${r.target}`).toBe(true); expect(r.at).toBeGreaterThan(1); expect(r.at).toBeLessThanOrEqual(20); }
    }
  });
  it("inputs are well formed; summons name real units", () => {
    for (const k of CLASS_KITS) for (const a of all(k)) {
      if (a.input?.kind === "charge") expect(a.input.min_s).toBeLessThan(a.input.max_s);
      for (const e of [...a.effects, ...(a.release ?? [])]) if (e.kind === "summon") expect(UNITS[e.unit] ?? ["weapon", "corpse"].includes(e.unit)).toBeTruthy();
    }
  });
  it("a look: a 3-stop hex ramp, a mote, an icon", () => {
    for (const k of CLASS_KITS) {
      expect(k.look.ramp).toHaveLength(3);
      for (const c of k.look.ramp) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      expect(k.look.icon).toMatch(/^\//);
    }
  });
});

describe("the per-class track and the stat direction (build overrides)", () => {
  it("unlocks Mending Sigil at mastery 3 and names it", () => {
    expect(kitAt(DEMO_KIT, 2).keys[4]).toBeNull();
    expect(kitAt(DEMO_KIT, 3).keys[4]?.key).toBe("demo.sigil");
    expect(unlocksAt(DEMO_KIT, 3)).toEqual(["New ability: Mending Sigil"]);
    expect(nextUnlock(DEMO_KIT, 1)).toEqual({ at: 3, what: ["New ability: Mending Sigil"] });
    expect(nextUnlock(DEMO_KIT, 18)).toBeNull();
  });
  it("applies ranks in order: Arc Bolt +20% at 5, the ult +10% at 10 and again at 18, the passive +25% at 16", () => {
    const bolt = DEMO_KIT.keys[0], power = (a: ClassAbility) => (a.effects[0] as { power: number }).power;
    expect(power(abilityAt(DEMO_KIT, bolt, 4))).toBeCloseTo(1.4);
    expect(power(abilityAt(DEMO_KIT, bolt, 5))).toBeCloseTo(1.68);
    expect(power(kitAt(DEMO_KIT, 9).ult)).toBeCloseTo(9);
    expect(power(kitAt(DEMO_KIT, 18).ult)).toBeCloseTo(9 * 1.21);
    expect([rankOf(DEMO_KIT, "ult", 9), rankOf(DEMO_KIT, "ult", 10), rankOf(DEMO_KIT, "ult", 18)]).toEqual([1, 2, 3]);
    expect(passiveAt(DEMO_KIT, 16).value).toBeCloseTo(0.125);
    expect(unlocksAt(DEMO_KIT, 18)).toEqual(["Demo Cataclysm rank III: +10% power"]);
  });
  it("upgrades scale power, radius, cooldown, energy and durations, and can add effects", () => {
    const a: ClassAbility = { key: "t", name: "T", description: "", cooldown_s: 10, energy: 20,
      effects: [{ kind: "area", power: 2, radius: 2, at: "self" }, { kind: "shield", amount: 0.1, duration: 4 }] };
    const b = upgraded(a, { label: "x", power: 1.2, radius: 1.25, cooldown: 0.8, energy: 0.5, duration: 1.5, add: [{ kind: "heal", amount: 0.05 }] });
    expect(b.cooldown_s).toBe(8);
    expect(b.energy).toBe(10);
    expect(b.effects[0]).toMatchObject({ power: 2.4, radius: 2.5 });
    expect(b.effects[1]).toMatchObject({ amount: 0.12, duration: 6 });
    expect(b.effects[2]).toEqual({ kind: "heal", amount: 0.05 });
    expect(a.effects[0]).toMatchObject({ power: 2 }); // the source is untouched
  });
  it("mastery raises the stat direction linearly from mastery 1 to 20", () => {
    expect(statAt(DEMO_KIT, 1)).toBe(100);
    expect(statAt(DEMO_KIT, 20)).toBe(160);
    expect(statAt(DEMO_KIT, 10)).toBeCloseTo(100 + (60 * 9) / 19);
    const m = classMods(DEMO_KIT, 20);
    expect(m.energyMax).toBe(160);
    expect(m.energyRegen).toBeCloseTo(19.2);
    expect({ ...m, energyMax: 100, energyRegen: 12 }).toEqual(NEUTRAL_MODS);
    expect(classMods({ ...DEMO_KIT, stat: { kind: "cooldown", at1: 1, at20: 0.25 } }, 20).cooldown).toBeCloseTo(0.25);
    expect(classMods({ ...DEMO_KIT, stat: { kind: "crit_damage", at1: 1.75, at20: 2.5 } }, 1).critMult).toBe(1.75);
  });
});

describe("the signature gate (§1.5) and the dev kit", () => {
  it("keys and the ult need the signature type in hand", () => {
    expect(holdsSignature(DEMO_KIT, "staff")).toBe(true);
    expect(holdsSignature(DEMO_KIT, "sword")).toBe(false);
    expect(signatureHint(DEMO_KIT)).toBe("Hold your staff");
  });
  it("the demo kit is found but never offered in production", () => {
    expect(classKit("demo")).toBe(DEMO_KIT);
    expect(memberKit("demo")).toBe(DEMO_KIT); // tests run outside production
    expect(classKit("elementalist")).toBeNull(); // wave 1 adds it
  });
});
