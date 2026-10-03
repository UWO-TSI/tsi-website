import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classKit, kitAt } from "@/lib/combat/classes";
import { RANGER_KITS } from "@/lib/combat/rangerKits";
import { WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import { SUBCLASS_FOR_TYPE } from "@/lib/oracle/subclass";
import { WEAPONS } from "./data";
import { FX } from "@/lib/game/fx/combat";
import { UNITS } from "@/lib/combat/kits";
import { gripFor, verbClip, verbInfo, VERBS, type Verb } from "@/lib/game/character/clips";

describe("the Ranger kits: shape and invariants", () => {
  it("each kit on the family's terms: keys 1–5, the movement key at mastery 3, one i-frame key (8 s+), two heavy at most, unique ults", () => {
    expect(RANGER_KITS.map(k => k.key)).toEqual(["marksman", "sniper", "hunter", "gunslinger"].slice(0, RANGER_KITS.length));
    for (const k of RANGER_KITS) {
      expect(classKit(k.key)).toBe(k);
      expect(k.family).toBe("Ranger");
      expect(k.keys.length).toBeGreaterThanOrEqual(4);
      expect(k.keys.length).toBeLessThanOrEqual(5);
      expect(new Set(k.keys.map(a => a.key)).size).toBe(k.keys.length);
      expect(kitAt(k, 1).keys.filter(a => a === null).length).toBe(1); // the movement key waits for mastery 3
      expect(kitAt(k, 3).keys.every(a => a !== null)).toBe(true);
      expect(k.keys.filter(a => a.heavy).length).toBeLessThanOrEqual(2);
      const iframes = k.keys.filter(a => a.effects.some(e => e.kind === "dash" && e.iframes));
      expect(iframes.length).toBeLessThanOrEqual(1);
      for (const a of iframes) expect(a.cooldown_s).toBeGreaterThanOrEqual(8);
      for (const a of k.keys) { expect(a.energy).toBeGreaterThanOrEqual(15); expect(a.energy).toBeLessThanOrEqual(45); }
      expect(k.ult.clip).toEqual({ unique: `Ult_${k.name}` });
      expect(k.ult.charge).toBeGreaterThanOrEqual(0.8); expect(k.ult.charge).toBeLessThanOrEqual(1.25);
      expect(k.ult.anticipation_ms).toBeGreaterThanOrEqual(250); expect(k.ult.anticipation_ms).toBeLessThanOrEqual(600);
      expect(k.fire).toBeDefined();
    }
  });
  it("each has its own signature type, tiers 1–5, with a look and a model; the Oracle suggests each once", () => {
    const types = RANGER_KITS.map(k => k.signature.type);
    expect(new Set(types).size).toBe(RANGER_KITS.length);
    for (const k of RANGER_KITS) {
      const tiers = SYSTEM_WEAPONS.filter(w => w.subclass === k.key);
      expect(tiers.map(w => w.tier)).toEqual([1, 2, 3, 4, 5]);
      expect(tiers.every(w => w.type === k.signature.type && w.scaling[0] === "finesse")).toBe(true);
      for (const w of tiers) expect(WEAPONS[w.key]?.model).toBe(`/assets/game/weapons/${w.key}.glb`);
      expect(tiers.map(w => !!WEAPONS[w.key].pulse)).toEqual([false, false, false, false, true]); // tier 5's runes breathe
      for (const w of tiers) expect(existsSync(join(__dirname, "../../../public", WEAPONS[w.key].model)), w.key).toBe(true);
      expect(Object.values(SUBCLASS_FOR_TYPE).filter(s => s.subclass === k.key).length).toBe(1);
      expect(SYSTEM_WEAPONS.filter(w => w.type === k.signature.type).every(w => w.subclass === k.key)).toBe(true); // the type is theirs alone
    }
  });
  it("every clip a kit names is in the verb library on its weapon's grip (verbs, Ult_* and Unique_* clips)", () => {
    for (const k of RANGER_KITS) {
      const grip = gripFor(k.signature.type), names: string[] = [];
      for (const a of [...k.keys, k.ult]) if (a.clip) names.push("verb" in a.clip ? verbClip(a.clip.verb as Verb, grip) : a.clip.unique);
      if (k.fire?.clip) names.push(verbClip(k.fire.clip.verb as Verb, grip));
      if (k.fire?.ammo?.clip) names.push(k.fire.ammo.clip);
      for (const a of k.keys) if (a.clip && "verb" in a.clip) expect((VERBS as readonly string[]).includes(a.clip.verb), a.key).toBe(true);
      for (const n of names) expect(verbInfo(n), `${k.key}: ${n}`).not.toBeNull();
      expect(verbInfo(k.ult.clip && "unique" in k.ult.clip ? k.ult.clip.unique : "")?.grip).toBe(grip);
    }
  });
  it("every FX key the kits name is in the registry: keys, the ult, the basic shot, rounds, bomblets, the zip, the perfect reload, trap springs", () => {
    for (const k of RANGER_KITS) {
      const keys: (string | undefined)[] = [];
      for (const a of [...k.keys, k.ult]) {
        keys.push(...Object.values(a.vfx ?? {}));
        for (const e of [...a.effects, ...(a.release ?? [])]) {
          if (e.kind === "projectile") keys.push(e.cluster?.fx, e.grapple);
          if (e.kind === "summon" && UNITS[e.unit]?.kind === "trap") keys.push(`trap.${e.unit}`);
        }
      }
      keys.push(...Object.values(k.fire?.vfx ?? {}), k.fire?.ammo?.perfect);
      for (const r of Object.values(k.fire?.rounds ?? {})) keys.push(r.vfx, r.travel, r.cast);
      for (const key of keys) if (key) expect(FX[key], `${k.key}: ${key}`).toBeDefined();
    }
  });
  it("every icon the kits name is on disk", () => {
    const pub = join(__dirname, "../../../public");
    for (const k of RANGER_KITS) for (const icon of [k.look.icon, k.ult.icon, k.passive.icon, ...k.keys.map(a => a.icon)]) expect(existsSync(join(pub, icon!)), icon).toBe(true);
  });
});
