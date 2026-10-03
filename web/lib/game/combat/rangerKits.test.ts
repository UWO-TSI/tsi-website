import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classKit, kitAt } from "@/lib/combat/classes";
import { RANGER_KITS } from "@/lib/combat/rangerKits";
import { WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import { SUBCLASS_FOR_TYPE } from "@/lib/oracle/subclass";
import { WEAPONS } from "./data";

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
      expect(Object.values(SUBCLASS_FOR_TYPE).filter(s => s.subclass === k.key).length).toBe(1);
      expect(SYSTEM_WEAPONS.filter(w => w.type === k.signature.type).every(w => w.subclass === k.key)).toBe(true); // the type is theirs alone
    }
  });
  it("every icon the kits name is on disk", () => {
    const pub = join(__dirname, "../../../public");
    for (const k of RANGER_KITS) for (const icon of [k.look.icon, k.ult.icon, k.passive.icon, ...k.keys.map(a => a.icon)]) expect(existsSync(join(pub, icon!)), icon).toBe(true);
  });
});
